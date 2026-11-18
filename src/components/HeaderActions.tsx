"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccountState } from "@/lib/client/account";
import { useT } from "@/lib/i18n/client";
import { resetPreview } from "./app/settings/PreviewTools";

/** Signed out: Sign in + Get started. Signed in: Open Dossierly (plus "Start onboarding fresh" on the onboarding preview). */
export function HeaderActions() {
  const t = useT("site");
  const s = useAccountState();
  const [onboardingPreview, setOnboardingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s !== "signed-in") return;
    let live = true;
    fetch("/api/account/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((a: { previewFlow?: string } | null) => { if (live) setOnboardingPreview(a?.previewFlow === "onboarding"); }).catch(() => undefined);
    return () => { live = false; };
  }, [s]);
  return (
    <div className="site-actions">
      <Link href="/pricing" className="nav-pricing-sm">{t("navPricing")}</Link>
      {s === "signed-in" ? (
        <>
          {onboardingPreview && (
            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={async () => { setBusy(true); if (!(await resetPreview(false))) setBusy(false); }}>
              {busy ? t("resetting") : t("onboardingFresh")}
            </button>
          )}
          <Link href="/app" className="btn btn-primary btn-small">{t("openApp")}</Link>
        </>
      ) : (
        <>
          <Link href="/signin" className="btn btn-ghost btn-small nav-signin">{t("signIn")}</Link>
          <Link href="/signup" className="btn btn-primary btn-small">{t("getStarted")}</Link>
        </>
      )}
    </div>
  );
}
