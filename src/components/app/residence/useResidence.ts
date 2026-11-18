"use client";
import { useState } from "react";
import { residenceAction } from "@/lib/client/residence";
import type { ResidenceAction } from "@/lib/residence/actions";
import { useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";

/** Sends one residence action and swaps in the case it returns. Failures toast and leave the screen as it was. */
export function useResidence() {
  const { replace } = useCaseData();
  const { toast } = useToast();
  const t = useT("residence");
  const [busy, setBusy] = useState(false);
  async function act(a: ResidenceAction, ok?: string): Promise<boolean> {
    setBusy(true);
    const r = await residenceAction(a);
    setBusy(false);
    if (r.ok) {
      replace(r.data);
      if (ok) toast(ok, { tone: "ok" });
      return true;
    }
    if (r.status === 401) { window.location.href = `/signin?next=${encodeURIComponent(location.pathname)}`; return false; }
    const msg = r.status === 0 ? t("offline") : r.code === "future_date" ? t("errFutureDate") : r.code === "no_approval" ? t("errNoApproval") : t("saveFailed");
    toast(msg, { tone: "error" });
    return false;
  }
  return { act, busy };
}
