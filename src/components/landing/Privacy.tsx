import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import { rich } from "@/lib/i18n/rich";

/** Privacy, Beside's "It asks first" pattern: three bordered cards, each with a small proof inside. */
export async function Privacy() {
  const t = await getT("landing");
  const ledger = [
    { t: `Claude Sonnet 5.5 · ${t("pvLedgerReading")}`, s: t("pvLedgerMasked", { time: "7:13 PM" }) },
    { t: "migrant.wsc.mazowieckie.pl", s: t("pvLedgerAllowed", { time: "7:12 PM" }) },
    { t: t("pvLedgerUnknown"), s: t("pvLedgerDenied", { time: "7:12 PM" }) },
  ];
  return (
    <section className="lp-sec" id="privacy" aria-labelledby="privacy-h">
      <div className="lp-wrap">
        <header className="lp-head-l">
          <h2 id="privacy-h" className="lp-h2"><span data-sweep>{t("pvTitle")}</span><span className="lp-h2-muted">{t("pvTitleMuted")}</span></h2>
        </header>
        <div className="lp-trio">
          <article className="lp-trio-card" data-reveal>
            <h3>{t("pv1")}</h3>
            <p>{t("pv1Body")}</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="shield" size={15} /> {t("pvSources")}</div>
                <div className="lp-ui-body">
                  <ul className="lp-ui-list">
                    <li className="is-ok"><span className="lp-ui-tick" aria-hidden="true"><Icon name="check" size={12} /></span>{t("pvOfficial")}</li>
                    <li className="is-ok"><span className="lp-ui-tick" aria-hidden="true"><Icon name="check" size={12} /></span>{t("pvApp")}</li>
                    <li className="is-miss"><span className="lp-ui-tick" aria-hidden="true">×</span>{t("pvDenied")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
          <article className="lp-trio-card" data-reveal>
            <h3>{t("pv2")}</h3>
            <p>{t("pv2Body")}</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="lock" size={15} /> {t("pvModelSees")}</div>
                <div className="lp-ui-body">
                  <p className="lp-mask">{rich(t("pvMask"), { name: <mark>[NAME_1]</mark>, passport: <mark>[PASSPORT_1]</mark>, case: <mark>[CASE_1]</mark> })}</p>
                  <div className="lp-ui-btns" aria-hidden="true">
                    <span className="lp-ui-btn lp-ui-btn-dark"><Icon name="lock" size={13} /> {t("pvRestored")}</span>
                  </div>
                </div>
              </div>
            </div>
          </article>
          <article className="lp-trio-card" data-reveal>
            <h3>{t("pv3")}</h3>
            <p>{t("pv3Body")}</p>
            <div className="lp-trio-well">
              <div className="lp-ui">
                <div className="lp-ui-head"><Icon name="file" size={15} /> {t("pvLedgerHead")}</div>
                <div className="lp-ui-body">
                  <ul className="lp-ledger">
                    {ledger.map((l) => (
                      <li key={l.t}><b>{l.t}</b><span>{l.s}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </div>
        <p className="lp-fine">
          {rich(t("pvFine"), { limits: <Link href="/limits" className="lp-ulink">{t("pvFineLink")}</Link> })}
        </p>
      </div>
    </section>
  );
}
