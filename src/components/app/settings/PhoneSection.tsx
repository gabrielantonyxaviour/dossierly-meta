"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { Button, Card, Pill, Row, Section, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";

const E164 = /^\+[1-9]\d{6,14}$/;

async function phoneAction(body: { action: "phone"; number: string } | { action: "skip_phone" }) {
  const res = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { error?: string; callsAvailable?: boolean };
  return res?.ok ? { ok: true as const, calls: !!data.callsAvailable } : { ok: false as const, error: data.error };
}

/**
 * Phone number and whether Dossierly can call it. The server decides call permission (approved demo accounts
 * only); everyone else sees an honest "coming soon".
 */
export function PhoneSection({ profile, eligible, loaded }: { profile: Profile; eligible: boolean; loaded: boolean }) {
  const { refresh } = useCaseData();
  const { toast } = useToast();
  const t = useT("settings");
  const [num, setNum] = useState(profile.phone.number ?? "");
  const [saving, setSaving] = useState(false);
  const normalized = num.replace(/[\s()-]/g, "");
  const valid = E164.test(normalized);
  const dirty = normalized !== (profile.phone.number ?? "");
  const save = async () => {
    if (!valid) return toast(t("phoneFormat"), { tone: "error" });
    setSaving(true);
    const r = await phoneAction({ action: "phone", number: normalized });
    setSaving(false);
    if (!r.ok) return toast(r.error ?? t("phoneSaveFailed"), { tone: "error" });
    await refresh();
    toast(r.calls ? t("phoneSavedCalls") : t("phoneSaved"), { tone: "ok" });
  };
  const remove = async () => {
    setSaving(true);
    const r = await phoneAction({ action: "skip_phone" });
    setSaving(false);
    if (!r.ok) return toast(r.error ?? t("phoneSaveFailed"), { tone: "error" });
    setNum("");
    await refresh();
    toast(t("phoneRemoved"), { tone: "ok" });
  };
  const on = profile.phone.callsEnabled && !!profile.phone.number;
  return (
    <Section title={t("phoneTitle")}>
      <Card flush>
        <div className="st-phone">
          <label className="ui-field">
            <span>{t("phoneLabel")}</span>
            <div className="st-phone-row">
              <input className="ui-input ui-num" inputMode="tel" autoComplete="tel" placeholder="+48 512 345 678" value={num} onChange={(e) => setNum(e.target.value)} aria-invalid={num ? !valid : undefined} />
              {dirty && num && <Button variant="primary" onClick={() => void save()} loading={saving}>{t("save")}</Button>}
              {!dirty && profile.phone.number && <Button variant="ghost" onClick={() => void remove()} disabled={saving}>{t("remove")}</Button>}
            </div>
            <small>{num && !valid ? t("phoneInvalid") : t("phoneHint")}</small>
          </label>
        </div>
        <Row icon="phone" iconBg="var(--agent-soft)" iconColor="var(--agent-ink)"
          title={t("callsTitle")}
          sub={!loaded ? t("checking") : on ? t("callsOn") : eligible ? t("callsEligible") : t("callsSoon")}
          end={on ? <Pill tone="ok" dot>{t("on")}</Pill> : eligible ? <Pill tone="outline">{t("off")}</Pill> : <Pill tone="outline">{t("comingSoon")}</Pill>} />
      </Card>
    </Section>
  );
}
