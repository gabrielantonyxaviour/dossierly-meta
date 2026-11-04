import Link from "next/link";
import { Icon } from "@/components/Icon";

/** "Don't take our word for it": the path to try a real read in a minute (sign up, Look, a test letter). */
export function FinalCta() {
  return (
    <section className="lp-sec" aria-labelledby="final-h">
      <div className="lp-wrap lp-final">
        <div>
          <p className="lp-mono">Try it in a minute</p>
          <h2 id="final-h" className="lp-h2 lp-final-h"><span className="lp-h2-muted">Don&apos;t take our word for it.</span>Watch it read a letter.</h2>
          <p className="lp-body">
            Sign up with your email, open Look and tap &ldquo;Use a test letter&rdquo;. Muse Spark reads it live, SAM 3.1
            outlines the date, the case number and what the office asks for, and Dossierly counts the deadline.
          </p>
          <ol className="lp-steps" aria-label="How to try it">
            <li><b>1</b>Sign up</li>
            <li><b>2</b>Open Look</li>
            <li><b>3</b>Use a test letter</li>
          </ol>
          <div className="lp-hero-ctas lp-ctas-l">
            <Link className="lp-btn lp-btn-dark" href="/signup"><Icon name="case" size={16} /> Start your case</Link>
            <Link className="lp-btn lp-btn-line" href="/app/look">Open Look</Link>
          </div>
        </div>
        <div className="lp-final-panel" data-reveal>
          <div className="lp-final-card">
            <div className="lp-final-top"><span className="lp-mono">Interpreting</span><span>Mazowiecki office</span></div>
            <div className="lp-ph-bubble lp-ph-off" lang="pl">„Proszę podać numer sprawy.”</div>
            <div className="lp-ph-bubble lp-ph-me">Please give your case number.</div>
            <div className="lp-ph-bubble lp-ph-off lp-ph-fade" lang="pl">„Przyjdzie pismo w tej sprawie.”</div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  { q: "What exactly is Dossierly?", a: "A personal AI caseworker for life abroad. You get your own private agent that remembers your whole residence case: it prepares you for official appointments, interprets while you talk to the official, reads the letters that follow and counts the deadlines." },
  { q: "Is this legal advice?", a: "No. Dossierly interprets and explains. It never gives legal or medical advice, and an interpret-only guard checks every turn." },
  { q: "Which countries and offices are covered?", a: "Poland first: temporary residence and work at the Mazowiecki office in Warsaw. Germany and France are next. A country goes live only when its offices, letter types and deadline rules are covered from their sources." },
  { q: "Which languages can I use?", a: "The official's side is Polish. You can speak English, Ukrainian, Hindi or Tamil. Interface labels are in English; content follows your language." },
  { q: "Does Dossierly keep my audio?", a: "No. Each spoken turn in Polish, English or Ukrainian is sent once for transcription by Meta Muse Voice Transcribe and deleted; only the text is kept. Hindi and Tamil use your browser's own recognition." },
  { q: "What happens to my personal data?", a: "Your case lives in a private case file on Cloudflare, one per account, readable only when you are signed in. It is never sold, and you can have it deleted at any time. Identifiers are masked before any model call, and every model call is listed in your privacy ledger." },
  { q: "What does it cost?", a: "Nothing during the beta. Everything is included, with fair daily limits that keep the service up for everyone. See the pricing page for the numbers." },
];

/** "Your questions, covered": heading and button on the left, an accordion on the right. */
export function Faq() {
  return (
    <section className="lp-sec" aria-labelledby="faq-h">
      <div className="lp-wrap lp-faq">
        <div>
          <h2 id="faq-h" className="lp-h2">Your questions, covered<span className="lp-h2-muted">Get started today</span></h2>
          <Link className="lp-btn lp-btn-dark lp-btn-lg" href="/signup">Get started</Link>
        </div>
        <div className="lp-faq-list">
          {FAQ.map((f, i) => (
            <details key={f.q} className="lp-faq-item" open={i === 0}>
              <summary>{f.q}<span className="lp-faq-ic" aria-hidden="true" /></summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
