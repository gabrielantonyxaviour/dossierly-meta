"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { Button, Card, Pill, Row, Section, useToast } from "@/components/ui";
import { useCaseData } from "../shell/case-data";

const E164 = /^\+[1-9]\d{6,14}$/;

async function phoneAction(body: { action: "phone"; number: string } | { action: "skip_phone" }) {
  const res = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { error?: string; callsAvailable?: boolean };
  return res?.ok ? { ok: true as const, calls: !!data.callsAvailable } : { ok: false as const, error: data.error ?? "Couldn’t save the number. Try again." };
}

/**
 * Phone number and whether Dossierly can call it. The server decides call permission (approved demo accounts
 * only); everyone else sees an honest "coming soon".
 */
export function PhoneSection({ profile, eligible, loaded }: { profile: Profile; eligible: boolean; loaded: boolean }) {
  const { refresh } = useCaseData();
  const { toast } = useToast();
  const [num, setNum] = useState(profile.phone.number ?? "");
  const [saving, setSaving] = useState(false);
  const normalized = num.replace(/[\s()-]/g, "");
  const valid = E164.test(normalized);
  const dirty = normalized !== (profile.phone.number ?? "");
  const save = async () => {
    if (!valid) return toast("Use international format, e.g. +48 512 345 678", { tone: "error" });
    setSaving(true);
    const r = await phoneAction({ action: "phone", number: normalized });
    setSaving(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    await refresh();
    toast(r.calls ? "Saved. Dossierly can call this number." : "Number saved", { tone: "ok" });
  };
  const remove = async () => {
    setSaving(true);
    const r = await phoneAction({ action: "skip_phone" });
    setSaving(false);
    if (!r.ok) return toast(r.error, { tone: "error" });
    setNum("");
    await refresh();
    toast("Number removed", { tone: "ok" });
  };
  const on = profile.phone.callsEnabled && !!profile.phone.number;
  return (
    <Section title="Phone calls">
      <Card flush>
        <div className="st-phone">
          <label className="ui-field">
            <span>Your phone number</span>
            <div className="st-phone-row">
              <input className="ui-input ui-num" inputMode="tel" autoComplete="tel" placeholder="+48 512 345 678" value={num} onChange={(e) => setNum(e.target.value)} aria-invalid={num ? !valid : undefined} />
              {dirty && num && <Button variant="primary" onClick={() => void save()} loading={saving}>Save</Button>}
              {!dirty && profile.phone.number && <Button variant="ghost" onClick={() => void remove()} disabled={saving}>Remove</Button>}
            </div>
            <small>{num && !valid ? "Use international format with the country code." : "Used only to call you about your case. Never shared."}</small>
          </label>
        </div>
        <Row icon="phone" iconBg="var(--agent-soft)" iconColor="var(--agent-ink)"
          title="Dossierly can call me"
          sub={!loaded ? "Checking…" : on ? "When a new letter or deadline arrives, Dossierly phones you and explains it." : eligible ? "Save your number to turn calls on." : "Outbound calls are coming soon. In-app voice works now."}
          end={on ? <Pill tone="ok" dot>On</Pill> : eligible ? <Pill tone="outline">Off</Pill> : <Pill tone="outline">Coming soon</Pill>} />
      </Card>
    </Section>
  );
}
