import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";

/** "Don't take our word for it": the path to try a real read in a minute (sign up, Look, a test letter). */
export async function FinalCta() {
  const t = await getT("landing");
  return (
    <section className="lp-sec" aria-labelledby="final-h">
      <div className="lp-wrap lp-final">
        <div>
          <p className="lp-mono">{t("finalEyebrow")}</p>
          <h2 id="final-h" className="lp-h2 lp-final-h"><span className="lp-h2-muted">{t("finalMuted")}</span>{t("finalTitle")}</h2>
          <p className="lp-body">{t("finalBody")}</p>
          <ol className="lp-steps" aria-label={t("finalStepsAria")}>
            <li><b>1</b>{t("finalStep1")}</li>
            <li><b>2</b>{t("finalStep2")}</li>
            <li><b>3</b>{t("finalStep3")}</li>
          </ol>
          <div className="lp-hero-ctas lp-ctas-l">
            <Link className="lp-btn lp-btn-dark" href="/signup"><Icon name="case" size={16} /> {t("startCase")}</Link>
            <Link className="lp-btn lp-btn-line" href="/app/look">{t("finalStep2")}</Link>
          </div>
        </div>
        <div className="lp-final-panel" data-reveal>
          <div className="lp-final-card">
            <div className="lp-final-top"><span className="lp-mono">{t("finalInterpreting")}</span><span>{t("finalOffice")}</span></div>
            <div className="lp-ph-bubble lp-ph-off" lang="pl">„Proszę podać numer sprawy.”</div>
            <div className="lp-ph-bubble lp-ph-me">{t("finalCaseNo")}</div>
            <div className="lp-ph-bubble lp-ph-off lp-ph-fade" lang="pl">„Przyjdzie pismo w tej sprawie.”</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* FAQ entry n reads faq{n}q and faq{n}a from the landing messages. */
const FAQ = [1, 2, 3, 4, 5, 6, 7];

/** "Your questions, covered": heading and button on the left, an accordion on the right. */
export async function Faq() {
  const t = await getT("landing");
  return (
    <section className="lp-sec" aria-labelledby="faq-h">
      <div className="lp-wrap lp-faq">
        <div>
          <h2 id="faq-h" className="lp-h2">{t("faqTitle")}<span className="lp-h2-muted">{t("faqMuted")}</span></h2>
          <Link className="lp-btn lp-btn-dark lp-btn-lg" href="/signup">{t("getStarted")}</Link>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((n, i) => (
            <details key={n} className="lp-faq-item" open={i === 0}>
              <summary>{t(`faq${n}q`)}<span className="lp-faq-ic" aria-hidden="true" /></summary>
              <p>{t(`faq${n}a`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
