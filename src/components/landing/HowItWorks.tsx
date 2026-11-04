import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { LetterMock, MeetMock, PrepareMock, WrapUpMock } from "./HiwMocks";

type Step = {
  id: string; tab: string; icon: IconName; eyebrow: string; title: string; body: string;
  features: { icon: IconName; name: string; desc: string }[]; caption: string; visual: ReactNode;
};

const STEPS: Step[] = [
  {
    id: "prepare", tab: "Before", icon: "prepare", eyebrow: "Before · Prepare",
    title: "Walk in knowing what to bring",
    body: "A checklist for your next appointment, built from today's official pages. Every line cites the exact paragraph and is ticked against what your case already holds.",
    features: [
      { icon: "link", name: "Cited checklists", desc: "Each line links to its paragraph on the official page." },
      { icon: "speak", name: "Polish phrases", desc: "The ones you will need at that counter, ready to say." },
    ],
    caption: "Prepare: Arjun's next visit, three of four items already in his case.",
    visual: <PrepareMock />,
  },
  {
    id: "meet", tab: "During", icon: "meet", eyebrow: "During · Meet",
    title: "Two-way interpreting at the counter",
    body: "Show an introduction card, then lay the phone flat in table mode: the official's half faces them, yours faces you. A watcher speaks up when a date, amount or document could be misunderstood.",
    features: [
      { icon: "mic", name: "Table mode", desc: "English, Ukrainian, Hindi or Tamil, to Polish and back." },
      { icon: "shield", name: "The watcher", desc: "Flags the dates, amounts and documents worth checking." },
    ],
    caption: "Meet: the official's line, interpreted, and the watcher's question.",
    visual: <MeetMock />,
  },
  {
    id: "wrap", tab: "After", icon: "check", eyebrow: "After · Wrap-up",
    title: "Leave with what was agreed, in writing",
    body: "What was agreed, what to bring and which dates were named, written up the moment you step away from the counter.",
    features: [
      { icon: "calendar", name: "Calendar", desc: "Every date named goes straight into your calendar." },
      { icon: "case", name: "Case memory", desc: "Filed into your agent's memory for the next letter." },
    ],
    caption: "Wrap-up: Arjun's fingerprint appointment on 18 September.",
    visual: <WrapUpMock />,
  },
  {
    id: "letters", tab: "Letters", icon: "letter", eyebrow: "Letters · Read, link, reply",
    title: "Every letter read, linked and answered on time",
    body: "Photograph a letter or upload the e-Doręczenia PDF. See the verbatim Polish beside the explanation, linked to everything said before. The deadline is computed in code with every step shown.",
    features: [
      { icon: "camera", name: "Read", desc: "Photo or PDF. Dates the model is unsure of are flagged." },
      { icon: "link", name: "Link", desc: "Connected to your earlier visits and letters." },
      { icon: "file", name: "Reply", desc: "A Polish cover letter, drafted for you to check." },
    ],
    caption: "Letters: a wezwanie, linked to the visit, with its deadline counted.",
    visual: <LetterMock />,
  },
];

/** How it works: sticky tabs, steps on the left, one sticky visual on the right that follows the step. */
export function HowItWorks() {
  return (
    <section className="lp-sec" id="how" aria-labelledby="how-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <h2 id="how-h" className="lp-h2" data-sweep>Built for how a residence case actually runs</h2>
          <p className="lp-body">One private agent for the office visit, the conversation at the counter and every letter that follows.</p>
        </header>
        <nav className="lp-tabs" aria-label="Steps">
          {STEPS.map((s, i) => (
            <a key={s.id} href={`#step-${s.id}`} data-step-link={s.id} className={`lp-tab${i === 0 ? " is-active" : ""}`}>
              <Icon name={s.icon} size={14} />{s.tab}
            </a>
          ))}
        </nav>
        <div className="lp-hiw">
          <div className="lp-hiw-steps">
            {STEPS.map((s, i) => (
              <article key={s.id} id={`step-${s.id}`} data-step={s.id} className={`lp-step${i === 0 ? " is-active" : ""}`}>
                <p className="lp-eyebrow">{s.eyebrow}</p>
                <h3 className="lp-h3">{s.title}</h3>
                <p className="lp-body">{s.body}</p>
                <ul className="lp-feats">
                  {s.features.map((f) => (
                    <li key={f.name}>
                      <Icon name={f.icon} size={18} />
                      <div><b>{f.name}</b><span>{f.desc}</span></div>
                    </li>
                  ))}
                </ul>
                <figure className="lp-hiw-inline">
                  {s.visual}
                  <figcaption>{s.caption}</figcaption>
                </figure>
              </article>
            ))}
          </div>
          <div className="lp-hiw-stage" aria-hidden="true">
            <div className="lp-hiw-sticky">
              {STEPS.map((s, i) => (
                <figure key={s.id} data-visual={s.id} className={`lp-hiw-visual${i === 0 ? " is-active" : ""}`}>
                  <div className="lp-hiw-card">{s.visual}</div>
                  <figcaption>{s.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
