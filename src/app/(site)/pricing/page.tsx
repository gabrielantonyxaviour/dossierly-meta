import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import "./pricing.css";

/* Plan A (Gabriel, 18 Nov 2026). Replaced by the billing plans config at integration. */
const P = { agency: "1,700", founding: 99, foundingCount: 100, case: 199, home: 399, members: 3, freeLetters: 3, referral: 40, seller: "Larinova Private Limited" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("pricing");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: "/pricing" } };
}

type Plan = { id: string; featured?: boolean; points: string[]; price: string; unit?: string; note: string; cta: string; href: string; badge: string; name: string };

export default async function PricingPage() {
  const t = await getT("pricing");
  const plans: Plan[] = [
    { id: "free", name: t("freeName"), badge: t("freeBadge"), price: t("freePrice"), note: t("freeNote"), cta: t("freeCta"), href: "/signup",
      points: [t("free1"), t("free2"), t("free3", { n: P.freeLetters }), t("free4")] },
    { id: "case", featured: true, name: t("caseName"), badge: t("caseBadge"), price: t("casePrice", { price: P.case }), unit: t("caseUnit"), note: t("caseNote"), cta: t("caseCta"), href: "/signup?next=%2Fapp%2Fplan%3Fplan%3Dcase",
      points: [t("case1"), t("case2"), t("case3"), t("case4"), t("case5")] },
    { id: "household", name: t("homeName"), badge: t("homeBadge"), price: t("homePrice", { price: P.home }), unit: t("homeUnit"), note: t("homeNote", { members: P.members }), cta: t("homeCta"), href: "/signup?next=%2Fapp%2Fplan%3Fplan%3Dhousehold",
      points: [t("home1"), t("home2"), t("home3"), t("home4")] },
  ];
  const faq = [
    [t("q1"), t("a1")], [t("q2"), t("a2", { n: P.freeLetters })], [t("q3"), t("a3")],
    [t("q4"), t("a4", { amount: P.referral })], [t("q5"), t("a5")], [t("q6"), t("a6")],
  ];

  return (
    <div className="wrap pricing-page pr">
      <header className="pricing-head">
        <span className="kicker">{t("kicker")}</span>
        <h1>{t("title")}</h1>
        <p className="lead muted">{t("lead")}</p>
      </header>

      <aside className="pr-founding" aria-label={t("foundingTitle", { price: P.founding })}>
        <b>{t("foundingTitle", { price: P.founding })}</b>
        <span>{t("foundingBody", { count: P.foundingCount, regular: P.case })}</span>
      </aside>

      <div className="plan-grid pr-grid">
        {plans.map((p) => (
          <section key={p.id} className={`plan pr-plan${p.featured ? " is-featured" : ""}`} aria-labelledby={`plan-${p.id}`}>
            <div className="plan-top"><h2 id={`plan-${p.id}`} className="plan-name">{p.name}</h2><span className="plan-badge">{p.badge}</span></div>
            <p className="plan-price"><span>{p.price}</span>{p.unit && <small>{p.unit}</small>}</p>
            <p className="plan-note">{p.note}</p>
            <ul className="plan-points">
              {p.points.map((x) => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}
            </ul>
            <div className="plan-cta"><Link href={p.href} className={`btn ${p.featured ? "btn-primary" : "btn-soft"} pr-cta`}>{p.cta}</Link></div>
          </section>
        ))}
      </div>

      <p className="pr-anchor small muted">{t("anchor", { agency: P.agency })}</p>

      <section className="pr-sec pr-pair" aria-label={t("referTitle")}>
        <div><h2>{t("referTitle")}</h2><p className="muted">{t("referBody", { amount: P.referral })}</p></div>
        <div><h2>{t("notAdviceTitle")}</h2><p className="muted">{t("notAdviceBody")}</p></div>
      </section>

      <section className="faq" aria-labelledby="pricing-faq-h">
        <h2 id="pricing-faq-h">{t("faqTitle")}</h2>
        <div className="faq-list">
          {faq.map(([q, a]) => (
            <details key={q} className="faq-item"><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="pricing-final">
        <h2 style={{ margin: 0 }}>{t("finalTitle")}</h2>
        <p className="muted" style={{ margin: 0 }}>{t("finalBody")}</p>
        <Link href="/signup" className="btn btn-primary pr-cta">{t("finalCta")}</Link>
      </section>
      <p className="pr-seller tiny muted">{t("seller", { seller: P.seller })}</p>
    </div>
  );
}
