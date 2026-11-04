"use client";

import Link from "next/link";
import { Icon, type IconName } from "../../Icon";

const STEPS: { icon: IconName; title: string; body: string; href: string }[] = [
  { icon: "prepare", title: "Prepare", body: "Before an appointment, your agent reads today's official pages and builds a checklist where every line cites its paragraph.", href: "/app/prepare" },
  { icon: "meet", title: "Meet", body: "At the counter, lay the phone flat. Each side reads in their own language, and a watcher flags dates, amounts and documents.", href: "/app/meet" },
  { icon: "calendar", title: "Wrap-up", body: "After the visit: what was agreed, what to bring and which dates were named, filed into your case.", href: "/app/meet" },
  { icon: "letter", title: "Letters", body: "Photograph a letter or upload the PDF. You see the Polish beside the explanation, the link to earlier visits and the deadline, counted step by step.", href: "/app/letters" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Where is my case stored?", a: "In your own private case file on Cloudflare, one per account, readable only when you are signed in. It is never sold. Names and case numbers are masked before any model call." },
  { q: "Can I open my case on another device?", a: "Yes. Sign in with a code sent to your email and your case opens on any device. Only your chat history stays in the browser where you had it." },
  { q: "How do I delete everything?", a: "Write to contact@cosmiclan.com from the email you sign in with. We delete your case file and your account." },
  { q: "Who can I write to?", a: "contact@cosmiclan.com. Dossierly is operated by Gabriel Antony Xaviour." },
];

export function HelpPage() {

  return (
    <div className="page page-wide help">
      <span className="tab-label">Learn</span>
      <h1 className="page-title">How Dossierly works</h1>
      <p className="muted lead">One private agent per person, with you before, during and after every visit.</p>

      <div className="help-steps">
        {STEPS.map((s) => (
          <Link key={s.title} href={s.href} className="help-step">
            <span className="help-ic"><Icon name={s.icon} size={20} /></span>
            <b>{s.title}</b>
            <span>{s.body}</span>
          </Link>
        ))}
      </div>

      <div className="help-grid">
        <section className="card help-card" aria-labelledby="agent-h">
          <span className="tab-label">Your agent</span>
          <h2 id="agent-h" className="h-card">Your private agent</h2>
          <p className="muted small">
            Every person gets a private agent that works on a masked copy of the case, running on Meta Muse models.
          </p>
          <Link className="btn btn-small" href="/app/privacy">See every call it made</Link>
        </section>

        <section className="card help-card" aria-labelledby="guard-h">
          <span className="tab-label">Interpret-only guard</span>
          <h2 id="guard-h" className="h-card">It interprets and explains. It never advises.</h2>
          <p className="muted small">Every turn passes a Muse Spark guard that refuses legal or medical advice.</p>
          <p className="muted small" style={{ margin: 0 }}>For advice about your case, find a lawyer in the Polish bar register, rejestradwokatow.pl.</p>
        </section>
      </div>

      <section className="help-faq" aria-labelledby="faq-h">
        <h2 id="faq-h">Help</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="faq-item">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
      <p className="small muted">
        <Link href="/limits">What we cannot promise yet</Link> · <Link href="/legal/terms">Terms</Link> · <Link href="/legal/privacy">Privacy notice</Link>
      </p>
    </div>
  );
}
