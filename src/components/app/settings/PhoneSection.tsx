"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { Button, Card, Pill, Row, Section, Switch, useToast } from "@/components/ui";
import { useCaseData } from "../shell/case-data";

const E164 = /^\+[1-9]\d{6,14}$/;

/** Phone number + "Dossierly can call me". Outbound calls run only for approved demo accounts; others see an honest "coming soon". */
export function PhoneSection({ profile, eligible, loaded }: { profile: Profile; eligible: boolean; loaded: boolean }) {
  const { patchProfile } = useCaseData();
  const { toast } = useToast();
  const [num, setNum] = useState(profile.phone.number ?? "");
  const [saving, setSaving] = useState(false);
  const normalized = num.replace(/[\s()-]/g, "");
  const valid = E164.test(normalized);
  const dirty = normalized !== (profile.phone.number ?? "");
  const saveNumber = async () => {
    if (!valid) return toast("Use international format, e.g. +48 512 345 678", { tone: "error" });
    setSaving(true);
    const ok = await patchProfile({ phone: { number: normalized, verified: false, callsEnabled: false } });
    setSaving(false);
    toast(ok ? "Number saved" : "Couldn’t save the number", { tone: ok ? "ok" : "error" });
  };
  const setCalls = async (on: boolean) => {
    const ok = await patchProfile({ phone: { callsEnabled: on } });
    if (!ok) toast("Couldn’t change call settings", { tone: "error" });
  };
  return (
    <Section title="Phone calls">
      <Card flush>
        <div className="st-phone">
          <label className="ui-field">
            <span>Your phone number</span>
            <div className="st-phone-row">
              <input className="ui-input ui-num" inputMode="tel" autoComplete="tel" placeholder="+48 512 345 678" value={num} onChange={(e) => setNum(e.target.value)} aria-invalid={num ? !valid : undefined} />
              {dirty && <Button variant="primary" onClick={() => void saveNumber()} loading={saving} disabled={!num}>Save</Button>}
            </div>
            <small>{num && !valid ? "Use international format with the country code." : "Used only to call you about your case. Never shared."}</small>
          </label>
        </div>
        <Row icon="phone" iconBg="var(--agent-soft)" iconColor="var(--agent-a)"
          title="Dossierly can call me"
          sub={!loaded ? "Checking…" : eligible ? "When a new letter or deadline arrives, Dossierly phones you and explains it." : "Outbound calls are coming soon. In-app voice works now."}
          end={eligible ? <Switch label="Allow Dossierly to call me" checked={profile.phone.callsEnabled} disabled={!profile.phone.number} onChange={(v) => void setCalls(v)} /> : <Pill tone="outline">Coming soon</Pill>} />
      </Card>
    </Section>
  );
}
