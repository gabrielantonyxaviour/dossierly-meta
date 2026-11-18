import type { CSSProperties } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";
import coverage from "../../../hub/poland/coverage.json";
import sources from "../../../hub/poland/sources.json";

export const PL_STATS = {
  offices: coverage.offices.length,
  letterTypes: coverage.letterTypes.length,
  watched: sources.sources.filter((s) => s.watch).length,
  sources: sources.sources.length,
  languages: 4,
};

/** Offices, letter types, sources and languages as a small stat row. */
export function StatRow({ t, stats, style }: { t: T; stats: typeof PL_STATS; style?: CSSProperties }) {
  return (
    <dl className="stat-row" style={style}>
      <div><dt>{t("statOffices")}</dt><dd className="mono">{stats.offices}</dd></div>
      <div><dt>{t("statLetterTypes")}</dt><dd className="mono">{stats.letterTypes}</dd></div>
      <div><dt>{t("statSources")}</dt><dd className="mono">{stats.sources}</dd></div>
      <div><dt>{t("statLanguages")}</dt><dd className="mono">{stats.languages}</dd></div>
    </dl>
  );
}

export async function CountryCards() {
  const t = await getT("site");
  return (
    <div className="country-grid">
      <Link href="/countries/poland" className="country-card is-live">
        <div className="row between">
          <b className="country-name">{t("poland")}</b>
          <span className="chip chip-ok">{t("supported")}</span>
        </div>
        <p className="small muted" style={{ margin: "6px 0 12px" }}>{t("polandCardSub")}</p>
        <StatRow t={t} stats={PL_STATS} />
        <span className="small" style={{ fontWeight: 650 }}>{t("seeDepth")} →</span>
      </Link>
      {["germany", "france"].map((c) => (
        <div key={c} className="country-card">
          <div className="row between">
            <b className="country-name">{t(c)}</b>
            <span className="chip">{t("comingNext")}</span>
          </div>
          <p className="small muted" style={{ margin: "6px 0 0" }}>{t("comingNextBody")}</p>
        </div>
      ))}
    </div>
  );
}

export async function CoverageSection() {
  const t = await getT("site");
  return (
    <section className="section wrap" aria-labelledby="cov-h">
      <div className="section-head">
        <span className="kicker">{t("navCountries")}</span>
        <h2 id="cov-h">{t("coverageTitle")}</h2>
        <p>{t("coverageBody")}</p>
      </div>
      <CountryCards />
    </section>
  );
}
