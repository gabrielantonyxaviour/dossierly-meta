"use client";

import { modelName, seconds, usd } from "@/lib/client/format";
import { useDossier } from "@/lib/client/store";

/** Which model did what for this case, from the run receipts returned with every result. */
export function RunsPanel() {
  const { runs } = useDossier();
  const total = runs.reduce((s, r) => s + r.costUsd, 0);
  const tokens = runs.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const cached = runs.reduce((s, r) => s + r.cachedTokens, 0);
  return (
    <section className="card stack" aria-labelledby="runs-h" style={{ ["--gap" as string]: "12px" }}>
      <div className="row between">
        <h2 id="runs-h" className="h-card">Models used for this case</h2>
        <span className="chip mono">{usd(total)} total</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Meta Muse models, called with storage off. {runs.length} calls · {tokens.toLocaleString("en-GB")} tokens · {cached.toLocaleString("en-GB")} served from cache.
      </p>
      {runs.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No model calls yet.</p> : (
        <div className="table-scroll">
          <table className="runs-table">
            <thead>
              <tr><th>Feature</th><th>Model</th><th>Where</th><th className="num">Tokens</th><th className="num">Cached</th><th className="num">Time</th><th className="num">Cost</th></tr>
            </thead>
            <tbody>
              {runs.slice(0, 40).map((r, i) => (
                <tr key={`${r.ts}-${i}`}>
                  <td>{r.feature}</td>
                  <td>{modelName(r.model)}</td>
                  <td>{r.ranOn === "sandbox" ? "your agent" : r.ranOn === "replay" ? "recorded" : "cloud"}</td>
                  <td className="num">{(r.tokensIn + r.tokensOut).toLocaleString("en-GB")}</td>
                  <td className="num">{r.cachedTokens.toLocaleString("en-GB")}</td>
                  <td className="num">{seconds(r.ms)}</td>
                  <td className="num">{usd(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
