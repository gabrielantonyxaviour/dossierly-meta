import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const PROCESSORS = [
  ["Cloudflare", "Hosting, the app's server code, the ledger and run logs (D1, EU jurisdiction)", "EU storage; global network"],
  ["Meta (Muse models)", "Runs the Muse models (Muse Spark, SAM 3.1, Muse Voice Transcribe) on masked text", "Storage off per call; Meta's own terms apply"],
  ["Resend", "Delivers sign-in codes to your email address", "Receives the address and the code; its own privacy policy applies"],
];

export default function PrivacyPolicy() {
  return (
    <article className="doc-page">
      <span className="kicker">Privacy policy · 1 November 2026</span>
      <h1>Privacy</h1>
      <p className="lead muted">Plainly: what we process, where it is kept and how to remove it. We do not claim Dossierly is “fully private”; the app shows you a ledger instead.</p>

      <h2>Controller</h2>
      <p>Gokul Nath (individual), <a href="mailto:darthstormer.ai@gmail.com">darthstormer.ai@gmail.com</a>. You are using an AI system.</p>

      <h2>What is stored where</h2>
      <table>
        <thead><tr><th>Data</th><th>Where</th><th>How</th></tr></thead>
        <tbody>
          <tr><td>Your case (profile, events, documents, deadlines, wrap-ups, letter explanations)</td><td>Your device only (IndexedDB)</td><td>Encrypted with AES-GCM; new cases use a non-exportable device key. Earlier encryption records are preserved.</td></tr>
          <tr><td>Your account id, sign-in email, and plan; earlier account credentials are preserved</td><td>Cloudflare D1, EU</td><td>Your email is used to send sign-in codes. Email sign-in does not recover local case data.</td></tr>
          <tr><td>Sign-in challenges</td><td>Cloudflare D1, EU</td><td>Codes are stored as a keyed hash and expire after 10 minutes. Expired challenges are removed on later code requests.</td></tr>
          <tr><td>Ledger and run logs (model, time, bytes, masked count, cost)</td><td>Cloudflare D1, EU</td><td>Hash-chained; no conversation text</td></tr>
          <tr><td>Deadline reminders</td><td>Cloudflare, EU</td><td>Only a date and a short label</td></tr>
          <tr><td>Letter images</td><td>Sent to the model to be read; not kept by us</td><td>If saving is offered later, encrypted on your device before upload</td></tr>
          <tr><td>Audio</td><td>Never received by Dossierly</td><td>Your browser&apos;s speech service turns speech into text</td></tr>
        </tbody>
      </table>

      <h2>Before any model call</h2>
      <p>Your name, case number, PESEL, phone numbers, IBANs, passport numbers and the addresses in your profile are replaced with placeholders. Your personal agent then works on the masked case as plain text.</p>

      <h2>Processors</h2>
      <table>
        <thead><tr><th>Who</th><th>For what</th><th>Notes</th></tr></thead>
        <tbody>{PROCESSORS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
      </table>

      <h2>Health data</h2>
      <p>Some cases involve health insurance or medical appointments. We process health information only when you choose to enter it, as your explicit consent, and you can delete it at any time with “Delete everything” in the app.</p>

      <h2>Legal basis and retention</h2>
      <ul>
        <li>Providing the service you asked for (contract): case processing, interpreting, letters.</li>
        <li>Explicit consent: health information you choose to add.</li>
      </ul>
      <p>Ledger, run logs and the account record are kept while you use Dossierly and deleted on request. Data on your device stays until you delete it.</p>

      <h2>Your rights</h2>
      <p>You can ask for access, correction, deletion, restriction, portability, or object to processing, by writing to darthstormer.ai@gmail.com. “Delete everything” in the app destroys the key and wipes the case on your device immediately. You can complain to the Polish supervisory authority, the President of the Personal Data Protection Office (UODO), <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer">uodo.gov.pl</a>, or to the authority in your EU country.</p>

      <p className="small muted">See also: <Link href="/legal/terms">Terms</Link> · <Link href="/limits">Published limitations</Link></p>
    </article>
  );
}
