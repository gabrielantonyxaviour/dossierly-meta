"use client";
import { useState } from "react";
import type { Profile } from "@/lib/case/types";
import { Button, InlineError, Sheet, useToast } from "@/components/ui";
import { useCaseData } from "../shell/case-data";
import { LANGS } from "./SettingsScreen";

/** Mount with a fresh `key` per opening so the form starts from the saved profile. Edit name, city, university/employer and language. Writes PATCH /api/case/profile. */
export function ProfileSheet({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: Profile }) {
  const { patchProfile } = useCaseData();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: profile.fullName ?? "", city: profile.city ?? "", organisation: profile.organisation ?? "", preferredLanguage: profile.preferredLanguage });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const clean = (s: string) => (s.trim() ? s.trim() : null);
    if (form.fullName.trim().length > 120 || form.city.trim().length > 80 || form.organisation.trim().length > 160) return setErr("One of the fields is too long.");
    setSaving(true); setErr(null);
    const ok = await patchProfile({ fullName: clean(form.fullName), city: clean(form.city), organisation: clean(form.organisation), preferredLanguage: form.preferredLanguage });
    setSaving(false);
    if (!ok) return setErr("Couldn’t save your profile. Check your connection and try again.");
    toast("Profile saved", { tone: "ok" });
    onClose();
  };
  const field = (key: keyof typeof form, label: string, placeholder: string, auto?: string) => (
    <label className="ui-field">
      <span>{label}</span>
      <input className="ui-input" value={form[key]} placeholder={placeholder} autoComplete={auto} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => void save()} loading={saving}>Save</Button></>}>
      <div className="st-form">
        {field("fullName", "Full name (as in passport)", "Arjun Raman", "name")}
        {field("city", "City in Poland", "Warsaw", "address-level2")}
        {field("organisation", "University or employer", "Warsaw University of Technology", "organization")}
        <label className="ui-field">
          <span>Language</span>
          <select className="ui-input" value={form.preferredLanguage} onChange={(e) => setForm((f) => ({ ...f, preferredLanguage: e.target.value }))}>
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <small>Chat, calls and Counter use this language with you. Polish stays Polish for the official.</small>
        </label>
        {err && <InlineError message={err} />}
      </div>
    </Sheet>
  );
}
