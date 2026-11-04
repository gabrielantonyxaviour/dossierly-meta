"use client";

import { useState } from "react";
import type { RegistryResult } from "@/lib/registries/types";
import { Icon } from "@/components/Icon";
import { errorText } from "../look/ndjson";

const TONE = { active: "chip-ok", inactive: "chip-deadline", not_found: "chip-deadline", unavailable: "chip-warn" } as const;
const WORD = { active: "Active", inactive: "Not active", not_found: "Not found", unavailable: "Registry unavailable" } as const;

/** Checks a university or employer against the Ministry of Finance white list and the KRS court register. */
export function EmployerCheck({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [q, setQ] = useState(defaultQuery);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RegistryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = q.replace(/[^0-9]/g, "");
    if (digits.length < 9) { setError("Enter a 10-digit NIP (tax number) or a KRS number."); return; }
    setBusy(true); setError(null); setRes(null);
    const param = digits.length === 10 && !digits.startsWith("0000") ? `nip=${digits}` : `krs=${digits}`;
    try {
      const r = await fetch(`/api/registries/check?${param}`);
      if (!r.ok) throw new Error((await errorText(r)).message);
      setRes((await r.json()) as RegistryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The registry check failed.");
    } finally {
      setBusy(false);
    }
  };

  const name = res?.vat?.name ?? res?.krs?.name;
  return (
    <section className="card stack mos-reg" style={{ ["--gap" as string]: "12px" }} aria-labelledby="reg-title">
      <div>
        <h3 id="reg-title" style={{ marginBottom: 2 }}>Is your university or employer real and active?</h3>
        <p className="small muted" style={{ margin: 0 }}>Checked live against the Ministry of Finance white list and the National Court Register (KRS).</p>
      </div>
      <form className="row" onSubmit={(e) => void run(e)}>
        <input className="input grow" style={{ flex: "1 1 180px" }} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} placeholder="NIP, e.g. 525-000-58-34" aria-label="NIP or KRS number" />
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="shield" size={18} />} Check</button>
      </form>
      {error && <p className="small" role="alert" style={{ margin: 0, color: "var(--deadline)" }}>{error}</p>}
      {res && (
        <div className="mos-reg-out stack" style={{ ["--gap" as string]: "8px" }}>
          <div className="row between">
            <b>{name ?? "No entity found"}</b>
            <span className={`chip ${TONE[res.verdict.status]}`}>{WORD[res.verdict.status]}</span>
          </div>
          <ul className="small" style={{ margin: 0 }}>{res.verdict.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          {(res.vat?.address || res.krs?.address) && <p className="small muted" style={{ margin: 0 }}>{res.vat?.address ?? res.krs?.address}</p>}
          <div className="row" style={{ gap: 12 }}>
            {res.verdict.sources.map((s) => <a key={s.url} className="cite" href={s.url} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> {s.label}</a>)}
          </div>
        </div>
      )}
    </section>
  );
}
