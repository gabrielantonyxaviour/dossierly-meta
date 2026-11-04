import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <article className="doc-page">
      <span className="kicker">Terms of use · 30 October 2026</span>
      <h1>Terms</h1>
      <div className="notice" style={{ margin: "18px 0" }}>
        <b>You are using an AI system.</b> Dossierly interprets and explains. It does not give legal or medical advice and does not act for you before any office.
      </div>

      <h2>Who runs Dossierly</h2>
      <p>Dossierly is operated by Gabriel Antony Xaviour, an individual. Contact: <a href="mailto:contact@cosmiclan.com">contact@cosmiclan.com</a>.</p>

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

      <h2>Fair use</h2>
      <p>Do not use Dossierly to harm others, to impersonate an official, or to process another person&apos;s data without their permission. We may limit requests to keep the service running for everyone.</p>

      <h2>Liability</h2>
      <p>We provide the service with care but cannot guarantee that every translation, explanation or calculation is correct. Nothing in these terms limits rights you have under Polish or EU consumer law.</p>

      <p className="small muted">See also: <Link href="/legal/privacy">Privacy</Link> · <Link href="/limits">Published limitations</Link></p>
    </article>
  );
}
