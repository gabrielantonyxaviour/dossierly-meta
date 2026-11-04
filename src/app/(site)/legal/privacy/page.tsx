import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const PROCESSORS = [
  ["Cloudflare", "Hosting, your case file, sign-in records and sign-in emails (Workers, Durable Objects, D1, Email Service)", "Global network; its own privacy policy applies"],
  ["Meta (Muse models)", "Muse Spark answers and reads letters, SAM 3.1 outlines what it reads, Muse Voice Transcribe turns speech into text", "Receives the parts of your case a task needs; Meta's terms apply"],
  ["ElevenLabs", "Turns Dossierly's replies into speech", "Receives the reply text only"],
  ["Composio", "Connects your Gmail and Google Calendar when you choose to", "Holds the connection; Dossierly reads only messages relevant to your case"],
  ["Twilio", "Places phone calls to you (approved demo accounts only)", "Receives your phone number and the call audio"],
];

export default function PrivacyPolicy() {
  return (
    <article className="doc-page">
      <span className="kicker">Privacy policy · 4 November 2026</span>
      <h1>Privacy</h1>
      <p className="lead muted">Plainly: what we process, where it is kept and how to remove it.</p>

      <h2>Controller</h2>
      <p>Gokul Nath (individual), <a href="mailto:darthstormer.ai@gmail.com">darthstormer.ai@gmail.com</a>. You are using an AI system.</p>

      <h2>What is stored where</h2>
      <table>
        <thead><tr><th>Data</th><th>Where</th><th>How</th></tr></thead>
        <tbody>
          <tr><td>Your case (profile, facts with their sources, documents, deadlines, tasks, appointments, timeline)</td><td>Your private case file on Cloudflare</td><td>One isolated store per account; only your signed-in session can read it</td></tr>
          <tr><td>Your account id, sign-in email and plan</td><td>Cloudflare D1</td><td>Your email is used to send sign-in codes</td></tr>
          <tr><td>Sign-in challenges</td><td>Cloudflare D1</td><td>Codes are stored as a keyed hash and expire after 10 minutes</td></tr>
          <tr><td>Photos and screenshots you add with Look</td><td>Sent to Meta&apos;s models to be read</td><td>Saved to your case only when you add them as documents</td></tr>
          <tr><td>Audio from voice, Counter and calls</td><td>Sent to Muse Voice Transcribe as you speak</td><td>Dossierly stores the transcript and summary, not the audio</td></tr>
          <tr><td>Email and calendar</td><td>Read through your connection when you allow it</td><td>Only messages from Polish offices and your university are added to your case; dates go to your calendar after you confirm</td></tr>
          <tr><td>Chat history</td><td>This device</td><td>Kept in your browser; cleared when you sign out</td></tr>
        </tbody>
      </table>

<h2>Processors</h2>
      <table>
        <thead><tr><th>Who</th><th>For what</th><th>Notes</th></tr></thead>
        <tbody>{PROCESSORS.map(([a, b, c]) => <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>)}</tbody>
      </table>

      <h2>Health data</h2>
      <p>Some cases involve health insurance or medical appointments. We process health information only when you choose to enter it, as your explicit consent, and you can ask us to delete it at any time.</p>

      <h2>Legal basis and retention</h2>
      <ul>
        <li>Providing the service you asked for (contract): your case file, letters, deadlines, Counter, calls.</li>
        <li>Explicit consent: health information you choose to add.</li>
      </ul>
      <p>Your case file and account record are kept while you use Dossierly and deleted on request.</p>

      <h2>Your rights</h2>
      <p>You can ask for access, correction, deletion, restriction, portability, or object to processing, by writing to darthstormer.ai@gmail.com. You can complain to the Polish supervisory authority, the President of the Personal Data Protection Office (UODO), <a href="https://uodo.gov.pl" target="_blank" rel="noreferrer">uodo.gov.pl</a>, or to the authority in your EU country.</p>

      <p className="small muted">See also: <Link href="/legal/terms">Terms</Link> · <Link href="/limits">Published limitations</Link></p>
    </article>
  );
}
