"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import { clock, modelName, shortHash } from "@/lib/client/format";
import type { Ledger, LedgerEntry } from "@/lib/client/types";
import { ErrorNote, Loading } from "../../States";

function describe(e: LedgerEntry): { title: string; detail: string; tone?: "ok" | "deny" } {
  if (e.kind === "model") {
    const [model, ...rest] = e.what.split(/\s+/);
    const name = model.includes("/") ? modelName(model) : e.what;
    return { title: model.includes("/") ? `${name}${rest.length ? ` · ${rest.join(" ")}` : ""}` : name, detail: [e.bytes !== undefined && `${(e.bytes / 1024).toFixed(1)} KB sent`, e.region && `region ${e.region}`, e.masked !== undefined && `${e.masked} personal ID${e.masked === 1 ? "" : "s"} masked`].filter(Boolean).join(" · ") };
  }
  if (e.kind === "egress") {
    return { title: e.what, detail: e.action === "denied" ? "blocked by the network policy" : "allowed by the network policy", tone: e.action === "denied" ? "deny" : "ok" };
  }
  return { title: e.what, detail: e.region ? `job · ${e.region}` : "job" };
}

export function LedgerPanel() {
  const [data, setData] = useState<Ledger | null>(null);
  const [err, setErr] = useState<ApiFailure | null>(null);
  const [filter, setFilter] = useState<"all" | "model" | "egress">("all");
  const [more, setMore] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const r = await api.ledger();
    if (r.ok) setData(r.data);
    else setErr(r);
  }, []);
  useEffect(() => {
    // Initial fetch; state is set when the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rows = data?.entries.filter((e) => filter === "all" || e.kind === filter) ?? [];
  const egress = data?.entries.filter((e) => e.kind === "egress") ?? [];

  return (
    <section className="card stack" aria-labelledby="ledger-h" style={{ ["--gap" as string]: "12px" }}>
      <div className="row between">
        <h2 id="ledger-h" className="h-card">Privacy ledger</h2>
        {data && <span className={`chip ${data.verified ? "chip-ok" : "chip-warn"}`}>{data.verified ? "✓ chain verified" : "chain check failed"}</span>}
      </div>
      <p className="small muted" style={{ margin: 0 }}>Every model call made for you and every network request your agent attempted, each entry hashed onto the one before. Change any row and the chain stops verifying.</p>
      {!data && !err && <Loading label="Loading your ledger…" />}
      {err && <ErrorNote failure={err} onRetry={() => void load()} />}
      {data && (
        <>
          <div>
            <span className="tab-label">Chain head (root hash)</span>
            <div className="root-box" style={{ marginTop: 4 }}>{data.root}</div>
          </div>
          <div className="row">
            {(["all", "model", "egress"] as const).map((f) => (
              <button key={f} className={`btn btn-small${filter === f ? " btn-primary" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === "all" ? `All (${data.entries.length})` : f === "model" ? "Model calls" : `Agent network (${egress.length})`}
              </button>
            ))}
            <button className="btn btn-small btn-ghost" onClick={() => void load()}>Refresh</button>
          </div>
          {rows.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>{filter === "egress" ? "Your agent has not made any network requests yet." : "Nothing recorded yet. Use any feature and it appears here."}</p>
          ) : (
            <ol className="ledger">
              {rows.slice(0, more ? 500 : 20).map((e) => {
                const x = describe(e);
                return (
                  <li key={`${e.seq}-${e.hash}`}>
                    <span className="when">{clock(e.ts)}</span>
                    <span>
                      <b>{x.title}</b>
                      {x.detail && <span className={`small ${x.tone === "deny" ? "" : "muted"}`} style={x.tone === "deny" ? { fontWeight: 700 } : undefined}> · {x.detail}</span>}
                    </span>
                    <span className="hash">#{e.seq} {shortHash(e.hash)} ← {shortHash(e.prevHash)}</span>
                  </li>
                );
              })}
            </ol>
          )}
          {rows.length > 20 && !more && <button className="btn btn-small" onClick={() => setMore(true)}>Show all {rows.length} entries</button>}
        </>
      )}
    </section>
  );
}
