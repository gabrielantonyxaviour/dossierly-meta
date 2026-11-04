import Link from "next/link";
import coverage from "../../../hub/poland/coverage.json";
import sources from "../../../hub/poland/sources.json";

export const PL_STATS = {
  offices: coverage.offices.length,
  letterTypes: coverage.letterTypes.length,
  watched: sources.sources.filter((s) => s.watch).length,
  sources: sources.sources.length,
  languages: 4,
};

export function CountryCards() {
  return (
    <div className="country-grid">
      <Link href="/countries/poland" className="country-card is-live">
        <div className="row between">
          <b className="country-name">Poland</b>
          <span className="chip chip-ok">Supported</span>
        </div>
        <p className="small muted" style={{ margin: "6px 0 12px" }}>Temporary residence and work · Mazowieckie voivodeship</p>
        <dl className="stat-row">
          <div><dt>Offices</dt><dd className="mono">{PL_STATS.offices}</dd></div>
          <div><dt>Letter types</dt><dd className="mono">{PL_STATS.letterTypes}</dd></div>
          <div><dt>Sources</dt><dd className="mono">{PL_STATS.sources}</dd></div>
          <div><dt>Languages</dt><dd className="mono">{PL_STATS.languages}</dd></div>
        </dl>
        <span className="small" style={{ fontWeight: 650 }}>See the depth of coverage →</span>
      </Link>
      {["Germany", "France"].map((c) => (
        <div key={c} className="country-card">
          <div className="row between">
            <b className="country-name">{c}</b>
            <span className="chip">Coming next</span>
          </div>
          <p className="small muted" style={{ margin: "6px 0 0" }}>Same caseworker, new office playbooks, letter types and deadline rules. Not available yet.</p>
        </div>
      ))}
    </div>
  );
}

export function CoverageSection() {
  return (
    <section className="section wrap" aria-labelledby="cov-h">
      <div className="section-head">
        <span className="kicker">Countries</span>
        <h2 id="cov-h">One country, done properly.</h2>
        <p>Every deadline rule is quoted from the statute. Every office page is read from the source. We add a country only when it reaches the same depth.</p>
      </div>
      <CountryCards />
    </section>
  );
}
