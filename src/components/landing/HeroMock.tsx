import { Icon, type IconName } from "@/components/Icon";

const RAIL: { icon: IconName; label: string; on?: boolean }[] = [
  { icon: "case", label: "Case" },
  { icon: "prepare", label: "Prepare" },
  { icon: "meet", label: "Meet" },
  { icon: "letter", label: "Letters", on: true },
  { icon: "calendar", label: "Deadlines" },
  { icon: "shield", label: "Privacy ledger" },
];

const DONE = [
  { t: "Read the wezwanie", s: "Done · 7:13 PM" },
  { t: "Linked it to your 18 Sep visit", s: "Done · 7:13 PM" },
  { t: "Counted the deadline", s: "Reply by Tue 10 Nov" },
  { t: "Drafted a Polish reply", s: "Ready for you to check" },
];

/** The hero's one large product view: Arjun's case, a letter just read. */
export function HeroMock() {
  return (
    <figure className="lp-app" aria-label="Dossierly reading a letter from the office">
      <div className="lp-app-rail" aria-hidden="true">
        <span className="lp-app-mark">D</span>
        <div className="lp-app-rail-icons">
          {RAIL.map((r) => (
            <span key={r.label} className={`lp-app-ic${r.on ? " is-on" : ""}`} title={r.label}>
              <Icon name={r.icon} size={17} />
            </span>
          ))}
        </div>
        <span className="lp-app-ic"><Icon name="lock" size={17} /></span>
      </div>

      <div className="lp-app-main">
        <p className="lp-app-time">Tue 27 Oct at 7:12 PM</p>
        <div className="lp-app-file">
          <Icon name="file" size={15} /> wezwanie.pdf <span>from e-Doręczenia</span>
        </div>
        <div className="lp-app-msg">
          This is a <b>wezwanie</b> from the Mazowiecki office. They ask for proof of health insurance covering your
          whole stay, and give you 14 days from delivery to send it.
        </div>
        <blockquote className="lp-app-quote" lang="pl">
          „…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”
          <span lang="en">Polish verbatim, from page 1</span>
        </blockquote>
        <div className="lp-app-msg">
          It matches what the official said on 18 Sep: a letter would follow. Your reply is due <b>Tuesday 10 November</b>.
          I drafted a Polish cover letter for you to check.
        </div>
        <div className="lp-app-composer" aria-hidden="true">
          <span className="lp-app-plus">+</span>
          <span className="lp-app-typed">Show me how you counted the 14 days</span>
          <span className="lp-app-send"><Icon name="arrow" size={14} /></span>
        </div>
        <p className="lp-app-fine">Dossierly interprets and explains. It never gives legal advice.</p>
      </div>

      <aside className="lp-app-side" aria-label="Your agent">
        <span className="lp-app-x" aria-hidden="true">×</span>
        <span className="lp-app-avatar" aria-hidden="true"><Icon name="case" size={30} /></span>
        <b className="lp-app-name">Your agent</b>
        <span className="lp-app-status"><span className="lp-dot-ok" aria-hidden="true" />Private case</span>
        <div className="lp-app-chips">
          <span>Muse Spark 1.3</span>
          <span>IDs masked</span>
        </div>
        <p className="lp-app-today">Today</p>
        <ul className="lp-app-done">
          {DONE.map((d) => (
            <li key={d.t}>
              <span className="lp-app-check" aria-hidden="true"><Icon name="check" size={13} /></span>
              <span><b>{d.t}</b><small>{d.s}</small></span>
            </li>
          ))}
        </ul>
      </aside>
    </figure>
  );
}
