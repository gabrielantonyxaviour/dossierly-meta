import Link from "next/link";
import { getT } from "@/lib/i18n/server";

const COUNTRIES = [
  { code: "PL", name: "ctPoland", sub: "ctPolandSub", live: true },
  { code: "DE", name: "ctGermany", sub: "ctNotYet", live: false },
  { code: "FR", name: "ctFrance", sub: "ctNotYet", live: false },
];

/** Countries, in Beside's "Integrates with your tools" pattern: a dark pill, then a quiet grid. */
export async function Countries() {
  const t = await getT("landing");
  return (
    <section className="lp-sec" aria-labelledby="countries-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="countries-h" className="lp-h2" data-sweep>{t("ctTitle")}</h2>
          <p className="lp-body">{t("ctBody")}</p>
          <Link href="/countries" className="lp-btn lp-btn-dark lp-btn-sm">{t("ctSee")}</Link>
        </header>
        <ul className="lp-countries">
          {COUNTRIES.map((c) => (
            <li key={c.code}>
              <span className="lp-country-code" aria-hidden="true">{c.code}</span>
              <div>
                <b>{t(c.name)} {c.live ? <span className="lp-tag lp-tag-live">{t("ctLive")}</span> : <span className="lp-tag">{t("ctNext")}</span>}</b>
                <span>{t(c.sub)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
