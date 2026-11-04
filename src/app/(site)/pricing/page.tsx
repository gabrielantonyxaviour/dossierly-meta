import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Dossierly is free during the beta: every feature included, with fair daily limits so the service stays up for everyone. No card, no checkout.",
  alternates: { canonical: "/pricing" },
};

const INCLUDED = [
  "Your own agent that knows your whole residence case",
  "Official letters read and explained, with the deadline counted step by step",
  "Reminders before every deadline and appointment",
  "Counter mode: interpreting at the office, then a wrap-up filed to your case",
  "Case reviews by Muse Wonder: risks, a dated plan and what doesn’t match",
  "Your email and calendar connected, if you choose",
  "Connect Claude or another AI assistant to your case",
];

/* Per-person limits, as enforced by the API (rateLimit / checkAndSpend / strategist LIMITS). */
const LIMITS: { what: string; limit: string; note?: string }[] = [
  { what: "Messages to your agent", limit: "20 a minute" },
  { what: "Letters and photos read", limit: "30 an hour" },
  { what: "Photo checks", limit: "20 a minute" },
  { what: "Searches of official Polish sources", limit: "5 a day", note: "A search Dossierly ran recently is reused and doesn’t count." },
  { what: "Voice turns transcribed", limit: "30 a minute" },
  { what: "Case reviews by Muse Wonder", limit: "US$0.50 of model time a day", note: "Usually enough for several full reviews." },
  { what: "Phone calls from Dossierly", limit: "3 every 10 minutes", note: "Approved demo accounts only, for now." },
  { what: "AI assistant connections", limit: "60 requests a minute per token", note: "Tools that run a model: 30 an hour per token." },
];

const FAQ = [
  { q: "Is it really free?", a: "Yes. During the beta every feature is included at no cost. There is no card to add and nothing to check out." },
  { q: "What happens after the beta?", a: "Pricing after the beta is not decided yet. We will tell you in the app and by email before anything changes, and we will never charge you unless you choose a paid plan yourself." },
  { q: "What happens when I reach a limit?", a: "That one feature pauses and Dossierly tells you when it is available again. Your case, deadlines and reminders keep working." },
  { q: "When do daily limits reset?", a: "At 00:00 UTC, which is 01:00 in Warsaw in winter and 02:00 in summer." },
  { q: "Why are there limits at all?", a: "Every answer runs Meta’s Muse models, which costs real money. During the beta all model use also shares one daily budget; if it runs out, model features pause until the reset. The limits keep Dossierly up for everyone." },
  { q: "Is my data the price?", a: "No. Your case is never sold and never used for advertising. You can have it deleted at any time by writing to contact@cosmiclan.com." },
];

export default function PricingPage() {
  return (
    <div className="wrap pricing-page pr">
      <header className="pricing-head">
        <span className="kicker">Pricing</span>
        <h1>Free during the beta</h1>
        <p className="lead muted">Everything is included. Fair daily limits keep the service up for everyone.</p>
      </header>

      <section className="plan is-featured pr-plan" aria-labelledby="plan-free">
        <div className="plan-top"><h2 id="plan-free" className="plan-name">Beta</h2><span className="plan-badge">Everything included</span></div>
        <p className="plan-price"><span>€0</span><small>no card needed</small></p>
        <ul className="plan-points">
          {INCLUDED.map((x) => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}
        </ul>
        <div className="plan-cta"><Link href="/signup" className="btn btn-primary pr-cta">Get started free</Link></div>
      </section>

      <section className="pr-sec" aria-labelledby="usage-h">
        <h2 id="usage-h">What counts as usage</h2>
        <p className="muted">Anything that runs a model or reaches outside your case: a message to your agent, a letter read, a voice turn, a search, a review or a call. Opening your case, checking deadlines, ticking off tasks and in-app reminders never count.</p>
        <ul className="pr-limits">
          {LIMITS.map((l) => (
            <li key={l.what}>
              <span className="pr-what">{l.what}</span>
              <b>{l.limit}</b>
              {l.note && <small className="pr-note">{l.note}</small>}
            </li>
          ))}
        </ul>
        <p className="small muted">Limits are per person. Daily limits reset at 00:00 UTC.</p>
      </section>

      <section className="faq" aria-labelledby="pricing-faq-h">
        <h2 id="pricing-faq-h">Questions</h2>
        <div className="faq-list">
          {FAQ.map((f) => (
            <details key={f.q} className="faq-item"><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </div>
      </section>

      <section className="pricing-final">
        <h2 style={{ margin: 0 }}>Your case, handled with you</h2>
        <p className="muted" style={{ margin: 0 }}>Set up in a few minutes. Free while we are in beta.</p>
        <Link href="/signup" className="btn btn-primary pr-cta">Get started</Link>
      </section>
    </div>
  );
}
