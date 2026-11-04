import Link from "next/link";

const POINTS = [
  { t: "Your own agent", d: "Each person gets their own private agent, which works only on your masked case and official sources." },
  { t: "A ledger of every call", d: "Every model call your agent makes is written to a hash-chained ledger you can open in the app." },
  { t: "IDs masked first", d: "Your name, case number, PESEL and addresses are replaced with placeholders before any model sees the text." },
  { t: "Encrypted on your device", d: "The case stays in your browser, encrypted with AES-GCM. Email sign-in gives you account access; it does not transfer your saved case." },
  { t: "Storage off", d: "Every model call is sent with storage switched off." },
];

export function PrivacySection() {
  return (
    <section className="section wrap" id="privacy" aria-labelledby="privacy-h">
      <div className="privacy-grid">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="kicker">Privacy you can check</span>
          <h2 id="privacy-h">We don&apos;t say &ldquo;fully private&rdquo;. We show you.</h2>
          <p>Your agent sees your masked case as plain text while it works. Everything else is designed so you can verify it rather than trust us.</p>
          <Link href="/limits" className="small">Read the published limitations →</Link>
        </div>
        <ul className="privacy-list">
          {POINTS.map((p) => (
            <li key={p.t}>
              <b>{p.t}</b>
              <span className="small muted">{p.d}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const BUILT = [
  "Meta Muse Spark",
  "SAM 3.1",
  "Muse Voice Transcribe",
  "Cloudflare",
];

export function BuiltOn() {
  return (
    <section className="section wrap" aria-labelledby="built-h">
      <div className="built">
        <span className="kicker" id="built-h">Built on</span>
        <ul className="built-list">{BUILT.map((b) => <li key={b}>{b}</li>)}</ul>
      </div>
    </section>
  );
}
