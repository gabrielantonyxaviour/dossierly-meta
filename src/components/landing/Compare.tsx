import { getT } from "@/lib/i18n/server";

/* Row n reads cmp{n}, cmp{n}Us and cmp{n}Them from the landing messages. */
const ROWS = [1, 2, 3, 4, 5];

function Yes() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="lp-cmp-ic">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.3 8.2l1.8 1.8 3.6-3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function No() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="lp-cmp-ic lp-cmp-no">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/** Why Dossierly: copy on the left, a quiet comparison table on the right. */
export async function Compare() {
  const t = await getT("landing");
  return (
    <section className="lp-sec lp-sec-lg" aria-labelledby="why-h">
      <div className="lp-wrap lp-why">
        <div>
          <p className="lp-eyebrow">{t("whyEyebrow")}</p>
          <h2 id="why-h" className="lp-h2" data-sweep>{t("whyTitle")}</h2>
          <p className="lp-body">{t("whyBody")}</p>
        </div>
        <div className="lp-cmp" data-reveal>
          <table>
            <caption className="sr-only">{t("cmpCaption")}</caption>
            <thead>
              <tr><td /><th scope="col">Dossierly</th><th scope="col" className="lp-cmp-them">{t("cmpThem")}</th></tr>
            </thead>
            <tbody>
              {ROWS.map((n) => (
                <tr key={n}>
                  <th scope="row">{t(`cmp${n}`)}</th>
                  <td><span><Yes />{t(`cmp${n}Us`)}</span></td>
                  <td className="lp-cmp-them"><span><No />{t(`cmp${n}Them`)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
