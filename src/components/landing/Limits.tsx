import { Icon, type IconName } from "@/components/Icon";

const LIMITS: { icon: IconName; title: string; body: React.ReactNode }[] = [
  {
    icon: "lock",
    title: "It never files for you",
    body: "MOS, inPOL and your signature stay yours. Dossierly shows you what to do and where; you are the one who presses submit.",
  },
  {
    icon: "scale",
    title: "It is not legal advice",
    body: (
      <>
        It interprets and explains. When your situation needs a lawyer, it says so. The Polish bar register lists them at{" "}
        <a href="https://rejestradwokatow.pl" target="_blank" rel="noopener noreferrer">rejestradwokatow.pl</a>.
      </>
    ),
  },
  {
    icon: "letter",
    title: "Your letter has the last word",
    body: "Check every date, amount and document name against the original. The date written in your letter wins over our count.",
  },
  {
    icon: "mic",
    title: "Many spoken languages, not all",
    body: "Speech works in English, Polish, Hindi, Tamil and more. Ukrainian and Russian speech is not supported yet; typing still works.",
  },
];

/** Honest limits, stated up front. */
export function Limits() {
  return (
    <section id="limits" className="dl-sec" aria-labelledby="limits-h">
      <div className="dl-wrap">
        <header className="dl-head" data-reveal>
          <span className="ui-eyebrow">Honest limits</span>
          <h2 id="limits-h" className="dl-h2">It guides. <em>You decide.</em></h2>
          <p className="dl-lead">A caseworker you can trust tells you what it won’t do.</p>
        </header>
        <ul className="dl-limits">
          {LIMITS.map((l) => (
            <li key={l.title} className="dl-limit" data-reveal>
              <span className="dl-limit-ic"><Icon name={l.icon} size={20} /></span>
              <h3 className="dl-limit-t">{l.title}</h3>
              <p className="dl-body">{l.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
