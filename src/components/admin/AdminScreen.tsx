"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorState, InlineError, Pill, Section, Segmented, Skeleton, TopBar, useToast } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { friendlyError } from "@/lib/client/api";
import { adminApi, day, grantLabel, type Grant, type Summary } from "./types";
import "@/components/ui/shell.css";
import "./admin.css";

/* Internal page for Gabriel: email whitelist, promo codes, usage and audit. English only. Server enforces admin. */
export function AdminScreen() {
  const { toast } = useToast();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await adminApi.summary();
    if (r.ok) { setData(r.data); setError(null); } else setError(friendlyError(r));
  }, []);
  useEffect(() => {
    let alive = true;
    void adminApi.summary().then((r) => { if (!alive) return; if (r.ok) setData(r.data); else setError(friendlyError(r)); });
    return () => { alive = false; };
  }, []);
  if (!data && error) return <div className="sh-page"><ErrorState message={error} onRetry={() => void load()} /></div>;
  if (!data) return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="40%" /><Skeleton h={220} r={20} /><Skeleton h={220} r={20} /></div>;

  return (
    <div className="sh-page sh-page--wide ad">
      <TopBar title="Admin" back={{ href: "/app", label: "App" }} sub="Free access and offers for Dossierly. Every change is written to the audit log." />
      <Section title="Email whitelist"><WhitelistForm onDone={load} toast={toast} />
        <Card flush className="ad-list">
          {data.whitelist.length === 0 && <p className="ad-empty">No entries yet.</p>}
          {data.whitelist.map((e) => (
            <div key={e.id} className="ad-row">
              <span className="ad-main"><b>{e.email}</b><span>{grantLabel(e.grant)} · grant ends {day(e.grantExpiresAt)} · entry ends {day(e.entryExpiresAt)}{e.note ? ` · ${e.note}` : ""}</span></span>
              <Pill tone={e.usedAt ? "ok" : "neutral"}>{e.usedAt ? `Used ${day(e.usedAt)}` : "Not used yet"}</Pill>
              <Button size="sm" variant="ghost" onClick={async () => { const r = await adminApi.removeEntry(e.id); if (r.ok) { toast("Removed"); void load(); } else toast(friendlyError(r), { tone: "error" }); }}>Remove</Button>
            </div>
          ))}
        </Card>
      </Section>
      <Section title="Promo codes"><PromoForm onDone={load} toast={toast} />
        <Card flush className="ad-list">
          {data.promos.length === 0 && <p className="ad-empty">No promo codes yet.</p>}
          {data.promos.map((p) => (
            <div key={p.id} className="ad-row">
              <span className="ad-main"><b className="ad-code">{p.code}</b><span>{p.percent}% off · {p.plans.join(", ")} · {p.uses}{p.maxUses ? `/${p.maxUses}` : ""} used · ends {day(p.expiresAt)}{p.note ? ` · ${p.note}` : ""}</span></span>
              <Pill tone={p.active ? "ok" : "neutral"}>{p.active ? "Active" : "Disabled"}</Pill>
              {p.active && <Button size="sm" variant="ghost" onClick={async () => { const r = await adminApi.disablePromo(p.id); if (r.ok) { toast("Disabled"); void load(); } else toast(friendlyError(r), { tone: "error" }); }}>Disable</Button>}
            </div>
          ))}
        </Card>
      </Section>
      <Section title="Audit log">
        <Card flush className="ad-list">
          {data.audit.length === 0 && <p className="ad-empty">Nothing yet.</p>}
          {data.audit.map((a) => (
            <div key={a.id} className="ad-row ad-row--audit">
              <span className="ad-when">{new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="ad-main"><b>{a.action}</b><span>{a.subject} · {a.actor}{a.detail ? ` · ${a.detail}` : ""}</span></span>
            </div>
          ))}
        </Card>
      </Section>
    </div>
  );
}

type Toast = ReturnType<typeof useToast>["toast"];

function WhitelistForm({ onDone, toast }: { onDone: () => Promise<void>; toast: Toast }) {
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Grant["kind"]>("one_case");
  const [pct, setPct] = useState("50");
  const [grantEnds, setGrantEnds] = useState<string | null>(null);
  const [entryEnds, setEntryEnds] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && (kind !== "discount_percent" || (/^\d+$/.test(pct) && +pct >= 1 && +pct <= 99));
  const add = async () => {
    setBusy(true); setErr(null);
    const grant: Grant = kind === "discount_percent" ? { kind, value: Number(pct) } : { kind };
    const r = await adminApi.addEntry({ email: email.trim(), grant, ...(grantEnds ? { grantExpiresAt: grantEnds } : {}), ...(entryEnds ? { entryExpiresAt: entryEnds } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    setBusy(false);
    if (!r.ok) { setErr(r.code === "whitelist_exists" ? "That email already has an entry." : friendlyError(r)); return; }
    toast(`Added ${r.data.email}`); setEmail(""); setNote(""); void onDone();
  };
  return (
    <Card className="ad-form">
      <label className="ui-field"><span className="ui-meta">Email</span><input className="ui-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" /></label>
      <Segmented<Grant["kind"]> label="Grant" value={kind} onChange={setKind} options={[{ value: "one_case", label: "One case free" }, { value: "household_year", label: "Household free" }, { value: "discount_percent", label: "Discount" }]} />
      {kind === "discount_percent" && <label className="ui-field"><span className="ui-meta">Discount, % (1–99)</span><input className="ui-input" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>}
      <div className="ad-two">
        <div className="ui-field"><span className="ui-meta">Access ends (optional)</span><DatePicker value={grantEnds ?? ""} onChange={(d) => setGrantEnds(d || null)} ariaLabel="Access ends" yearPicks={[2026, 2027, 2028]} /></div>
        <div className="ui-field"><span className="ui-meta">Offer valid until (optional)</span><DatePicker value={entryEnds ?? ""} onChange={(d) => setEntryEnds(d || null)} ariaLabel="Offer valid until" yearPicks={[2026, 2027, 2028]} /></div>
      </div>
      <label className="ui-field"><span className="ui-meta">Note</span><input className="ui-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Who and why" maxLength={200} /></label>
      {err && <InlineError message={err} />}
      <Button variant="primary" disabled={!valid || busy} loading={busy} onClick={() => void add()}>Add to whitelist</Button>
    </Card>
  );
}

function PromoForm({ onDone, toast }: { onDone: () => Promise<void>; toast: Toast }) {
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("100");
  const [plan, setPlan] = useState<"one_case" | "household_year" | "both">("one_case");
  const [maxUses, setMaxUses] = useState("");
  const [ends, setEnds] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Z0-9-]{4,16}$/.test(code) && /^\d+$/.test(pct) && +pct >= 1 && +pct <= 100 && (maxUses === "" || +maxUses >= 1);
  const add = async () => {
    setBusy(true); setErr(null);
    const plans = plan === "both" ? ["one_case", "household_year"] as const : [plan];
    const r = await adminApi.addPromo({ code, percent: Number(pct), plans: [...plans], ...(maxUses ? { maxUses: Number(maxUses) } : {}), ...(ends ? { expiresAt: ends } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    setBusy(false);
    if (!r.ok) { setErr(r.code === "promo_exists" ? "That code already exists." : r.code === "promo_reserved" ? "That code is reserved." : r.code === "dodo_failed" ? "Dodo did not accept the code. Nothing was saved." : friendlyError(r)); return; }
    toast(`Created ${r.data.code}`); setCode(""); setNote(""); void onDone();
  };
  return (
    <Card className="ad-form">
      <div className="ad-two">
        <label className="ui-field"><span className="ui-meta">Code (4–16, A–Z, 0–9, -)</span><input className="ui-input ad-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16))} placeholder="WARSAW-2026" autoComplete="off" /></label>
        <label className="ui-field"><span className="ui-meta">Discount, % (100 = free)</span><input className="ui-input" inputMode="numeric" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 3))} /></label>
      </div>
      <Segmented<"one_case" | "household_year" | "both"> label="Plans" value={plan} onChange={setPlan} options={[{ value: "one_case", label: "One case" }, { value: "household_year", label: "Household" }, { value: "both", label: "Both" }]} />
      <div className="ad-two">
        <label className="ui-field"><span className="ui-meta">Max uses (optional)</span><input className="ui-input" inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, "").slice(0, 5))} /></label>
        <div className="ui-field"><span className="ui-meta">Valid until (optional)</span><DatePicker value={ends ?? ""} onChange={(d) => setEnds(d || null)} ariaLabel="Valid until" yearPicks={[2026, 2027, 2028]} /></div>
      </div>
      <label className="ui-field"><span className="ui-meta">Note</span><input className="ui-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Campaign or person" maxLength={200} /></label>
      {err && <InlineError message={err} />}
      <Button variant="primary" disabled={!valid || busy} loading={busy} onClick={() => void add()}>Create code</Button>
    </Card>
  );
}
