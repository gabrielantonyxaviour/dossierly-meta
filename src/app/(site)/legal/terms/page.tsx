import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("legal");
  return { title: t("termsTitle") };
}

export default async function TermsPage() {
  const [t, locale] = await Promise.all([getT("legal"), getLocale()]);
  return (
    <article className="doc-page">
      <span className="kicker">{t("termsKicker")}</span>
      <h1>{t("termsTitle")}</h1>
      {locale !== "en" && <p className="notice small" role="note">{t("bindingEnglish")}</p>}
      <div lang="en">
        <div className="notice" style={{ margin: "18px 0" }}>
          <b>You are using an AI system.</b> Dossierly interprets and explains. It does not give legal or medical advice and does not act for you before any office.
        </div>

        <h2>Who runs Dossierly</h2>
        <p>Dossierly is operated by Larinova Private Limited. Contact: <a href="mailto:gabriel@larinova.com">gabriel@larinova.com</a>.</p>

        <h2>What the service does</h2>
        <ul>
          <li>Prepares checklists for appointments at Polish immigration offices from official public pages, with citations.</li>
          <li>Interprets a conversation between you and an official, both ways.</li>
          <li>Reads official letters, explains them, links them to your case, counts deadlines and drafts a Polish cover letter for you to check and send yourself.</li>
        </ul>

        <h2>What it does not do</h2>
        <ul>
          <li>It is not a lawyer, doctor or official interpreter (tłumacz przysięgły). Its output is not legal or medical advice.</li>
          <li>It can be wrong. Check every date, amount and document name against the original. The date written in your letter always takes precedence over our calculation.</li>
          <li>It does not submit anything to an office on your behalf.</li>
        </ul>
        <p>
          If you need advice about your case, find a qualified lawyer, for example through the Polish bar register:{" "}
          <a href="https://rejestradwokatow.pl/" target="_blank" rel="noreferrer">rejestradwokatow.pl</a>.
        </p>

        <h2>Plans and payment</h2>
        <ul>
          <li>Free: your case path, the deadline calculator, three letters explained and email reminders.</li>
          <li>One case: 199 zł once. It covers one person&apos;s residence case for 18 months from payment and does not renew.</li>
          <li>Household year: 399 zł for 12 months, for you and up to three family members. It does not renew automatically; we remind you before it ends.</li>
          <li>Prices are in Polish złoty and include VAT. Founding and referral discounts are shown at checkout before you pay.</li>
          <li>Dossierly is sold by Larinova Private Limited. Payments are processed by Dodo Payments, our merchant of record, who issues your receipt and handles payment questions and refunds.</li>
          <li>Right of withdrawal: you may withdraw within 14 days of payment. If you ask us to start the paid service straight away, you agree that the 14-day right ends once the service has been fully provided; if you withdraw earlier, write to <a href="mailto:gabriel@larinova.com">gabriel@larinova.com</a> and we refund you.</li>
          <li>Paid access gives no different legal outcome. Dossierly cannot speed up or influence any office&apos;s decision.</li>
        </ul>

        <h2>Fair use</h2>
        <p>Do not use Dossierly to harm others, to impersonate an official, or to process another person&apos;s data without their permission. We may limit requests to keep the service running for everyone.</p>

        <h2>Liability</h2>
        <p>We provide the service with care but cannot guarantee that every translation, explanation or calculation is correct. Nothing in these terms limits rights you have under Polish or EU consumer law.</p>

      </div>
      <p className="small muted">{t("seeAlso")} <Link href="/legal/privacy">{t("privacyTitle")}</Link> · <Link href="/limits">{t("limitsLink")}</Link></p>
    </article>
  );
}
