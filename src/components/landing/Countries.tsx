import Link from "next/link";

const COUNTRIES = [
  { code: "PL", name: "Poland", sub: "Mazowiecki office, Warsaw", live: true },
  { code: "DE", name: "Germany", sub: "Not available yet", live: false },
  { code: "FR", name: "France", sub: "Not available yet", live: false },
];

/** Countries, in Beside's "Integrates with your tools" pattern: a dark pill, then a quiet grid. */
export function Countries() {
  return (
    <section className="lp-sec" aria-labelledby="countries-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="countries-h" className="lp-h2" data-sweep>Poland first, then country by country</h2>
          <p className="lp-body">A country goes live only when its offices, letter types and deadline rules are covered from their sources.</p>
          <Link href="/countries" className="lp-btn lp-btn-dark lp-btn-sm">See coverage</Link>
        </header>
        <ul className="lp-countries">
          {COUNTRIES.map((c) => (
            <li key={c.code}>
              <span className="lp-country-code" aria-hidden="true">{c.code}</span>
              <div>
                <b>{c.name} {c.live ? <span className="lp-tag lp-tag-live">Live</span> : <span className="lp-tag">Next</span>}</b>
                <span>{c.sub}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
