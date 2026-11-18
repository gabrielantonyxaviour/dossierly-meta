"use client";

import { modelName, seconds, usd } from "@/lib/client/format";
import { useDossier } from "@/lib/client/store";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

/** Which model did what for this case, from the run receipts returned with every result. */
export function RunsPanel() {
  const { runs } = useDossier();
  const t = useT("privacy");
  const tag = LOCALE_TAGS[useLocale()];
  const num = (n: number) => n.toLocaleString(tag);
  const total = runs.reduce((s, r) => s + r.costUsd, 0);
  const tokens = runs.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const cached = runs.reduce((s, r) => s + r.cachedTokens, 0);
  return (
    <section className="card stack" aria-labelledby="runs-h" style={{ ["--gap" as string]: "12px" }}>
      <div className="row between">
        <h2 id="runs-h" className="h-card">{t("runsTitle")}</h2>
        <span className="chip mono">{t("runsTotal", { amount: usd(total) })}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {t("runsIntro", { calls: num(runs.length), tokens: num(tokens), cached: num(cached) })}
      </p>
      {runs.length === 0 ? <p className="small muted" style={{ margin: 0 }}>{t("runsEmpty")}</p> : (
        <div className="table-scroll">
          <table className="runs-table">
            <thead>
              <tr><th>{t("colFeature")}</th><th>{t("colModel")}</th><th>{t("colWhere")}</th><th className="num">{t("colTokens")}</th><th className="num">{t("colCached")}</th><th className="num">{t("colTime")}</th><th className="num">{t("colCost")}</th></tr>
            </thead>
            <tbody>
              {runs.slice(0, 40).map((r, i) => (
                <tr key={`${r.ts}-${i}`}>
                  <td>{r.feature}</td>
                  <td>{modelName(r.model)}</td>
                  <td>{r.ranOn === "sandbox" ? t("ranAgent") : r.ranOn === "replay" ? t("ranReplay") : t("ranCloud")}</td>
                  <td className="num">{num(r.tokensIn + r.tokensOut)}</td>
                  <td className="num">{num(r.cachedTokens)}</td>
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
