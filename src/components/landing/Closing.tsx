import { AgentOrb, ButtonLink } from "@/components/ui";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Who is Dossierly for?",
    a: "People from outside the EU who live in Poland on a temporary residence permit, or are applying for one: students, workers and families. It starts with the Mazowiecki office in Warsaw.",
  },
  {
    q: "Will it submit my application or log in to MOS for me?",
    a: "No. Filing in MOS and checking inPOL stay with you. Dossierly tells you what each step needs, checks your documents and photo, and keeps the dates.",
  },
  {
    q: "How are deadlines worked out?",
    a: "In code, with the rules of the Code of Administrative Procedure: counting starts the day after delivery, a deadline ending on a Saturday or public holiday moves to the next working day, and an uncollected letter counts as delivered 14 days after the first notice. Each step is shown with its article. You confirm the delivery date.",
  },
  {
    q: "What does it do with my Gmail?",
    a: "Access is read-only. It looks for official mail about your case, such as appointment emails and summonses, and turns it into facts you can review. It never sends email from your account.",
  },
  {
    q: "Which languages can I use?",
    a: "Speech works in English, Polish, Hindi, Tamil and many more. Ukrainian and Russian speech is not supported by the speech model yet, so please type instead.",
  },
  {
    q: "Can Dossierly really phone me?",
    a: "Phone calls about new letters are coming soon. They work today on our demo account; everyone else gets notifications in the app.",
  },
  {
    q: "Is this legal advice?",
    a: "No. Dossierly interprets and explains, and tells you when to see a lawyer. It can be wrong, so check dates and names against the original letter.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="dl-sec" aria-labelledby="faq-h">
      <div className="dl-wrap dl-faq">
        <header className="dl-head" data-reveal>
          <span className="ui-eyebrow">Questions</span>
          <h2 id="faq-h" className="dl-h2">Before you start</h2>
        </header>
        <div className="dl-faq-list">
          {FAQ.map((f) => (
            <details key={f.q} className="dl-faq-item">
              <summary>{f.q}</summary>
              <p className="dl-body">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="dl-sec dl-final-sec" aria-labelledby="final-h">
      <div className="dl-wrap">
        <div className="dl-final" data-reveal>
          <AgentOrb size={64} state="idle" />
          <h2 id="final-h" className="dl-h2">Know your next step, <em>every day</em></h2>
          <p className="dl-lead">Set up your case in a few minutes. Dossierly takes it from there, with you.</p>
          <div className="dl-ctas">
            <ButtonLink href="/signup" variant="primary" size="lg" iconEnd="forward">Get started</ButtonLink>
            <ButtonLink href="/signin" variant="secondary" size="lg">Sign in</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
