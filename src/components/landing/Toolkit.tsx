import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { GmailLogo, GoogleCalendarLogo } from "@/components/ui/logos";

type Tool = { icon: IconName; title: string; body: string; chips: ReactNode[]; wide?: boolean };

const TOOLS: Tool[] = [
  {
    icon: "prepare",
    title: "A plan for every visit",
    body: "Before an appointment it searches today’s official pages and builds your checklist. Each line cites its source and is ticked against what your case already holds.",
    chips: [<><Icon name="globe" size={13} /> Official pages, cited</>, <><Icon name="check" size={13} /> Matched to your documents</>],
    wide: true,
  },
  {
    icon: "speak",
    title: "Rehearse the interview",
    body: "Practise with a simulated official who speaks Polish and asks about your real case, then get feedback on what to say differently.",
    chips: [<>Polish-speaking official</>, <>Feedback at the end</>],
    wide: true,
  },
  {
    icon: "photo",
    title: "MOS photo check",
    body: "Checks your application photo against the MOS rules and crops it to size without touching your face.",
    chips: [<>684 × 883 px</>, <>35 × 45</>, <>≤ 2.5 MB</>],
  },
  {
    icon: "case",
    title: "Employer check",
    body: "Looks an employer up in the Ministry of Finance VAT whitelist and the KRS company register before you sign.",
    chips: [<>VAT whitelist</>, <>KRS</>],
  },
  {
    icon: "link",
    title: "Gmail and Google Calendar",
    body: "Connect your inbox read-only so official mail becomes part of your case, and let dates go straight into your calendar.",
    chips: [<><GmailLogo size={14} /> Gmail</>, <><GoogleCalendarLogo size={14} /> Calendar</>],
  },
];

/** Smaller tools around the three moments, as a bento grid. */
export function Toolkit() {
  return (
    <section className="dl-sec dl-sec--band" aria-labelledby="tools-h">
      <div className="dl-wrap">
        <header className="dl-head" data-reveal>
          <span className="ui-eyebrow">Around the moments</span>
          <h2 id="tools-h" className="dl-h2">The rest of the paperwork, <em>handled with you</em></h2>
        </header>
        <ul className="dl-tools">
          {TOOLS.map((t) => (
            <li key={t.title} className={`dl-tool${t.wide ? " dl-tool--wide" : ""}`} data-reveal>
              <span className="dl-tool-ic"><Icon name={t.icon} size={20} /></span>
              <h3 className="dl-tool-t">{t.title}</h3>
              <p className="dl-body">{t.body}</p>
              <p className="dl-chips">{t.chips.map((c, i) => <span key={i} className="dl-chip">{c}</span>)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
