import { Icon, type IconName } from "@/components/Icon";
import { rich } from "@/lib/i18n/rich";
import type { T } from "@/lib/i18n/translate";

const RAIL: { icon: IconName; key: string; on?: boolean }[] = [
  { icon: "case", key: "railCase" },
  { icon: "prepare", key: "railPrepare" },
  { icon: "meet", key: "railMeet" },
  { icon: "letter", key: "railLetters", on: true },
  { icon: "calendar", key: "railDeadlines" },
  { icon: "shield", key: "railLedger" },
];

/** The hero's one large product view: Arjun's case, a letter just read. */
export function HeroMock({ t }: { t: T }) {
  const done = [
    { t: t("mockDone1"), s: t("mockDoneAt", { time: "7:13 PM" }) },
    { t: t("mockDone2"), s: t("mockDoneAt", { time: "7:13 PM" }) },
    { t: t("mockDone3"), s: t("mockDone3s") },
    { t: t("mockDone4"), s: t("mockDone4s") },
  ];
  return (
    <figure className="lp-app" aria-label={t("mockAria")}>
      <div className="lp-app-rail" aria-hidden="true">
        <span className="lp-app-mark">D</span>
        <div className="lp-app-rail-icons">
          {RAIL.map((r) => (
            <span key={r.key} className={`lp-app-ic${r.on ? " is-on" : ""}`} title={t(r.key)}>
              <Icon name={r.icon} size={17} />
            </span>
          ))}
        </div>
        <span className="lp-app-ic"><Icon name="lock" size={17} /></span>
      </div>

      <div className="lp-app-main">
        <p className="lp-app-time">{t("mockTime")}</p>
        <div className="lp-app-file">
          <Icon name="file" size={15} /> wezwanie.pdf <span>{t("mockFrom")}</span>
        </div>
        <div className="lp-app-msg">{rich(t("mockMsg1"), { w: <b>wezwanie</b> })}</div>
        <blockquote className="lp-app-quote" lang="pl">
          „…w terminie 14 dni od dnia doręczenia niniejszego wezwania…”
          <span lang={t("langTag")}>{t("mockVerbatim")}</span>
        </blockquote>
        <div className="lp-app-msg">{rich(t("mockMsg2"), { date: <b>{t("mockDue")}</b> })}</div>
        <div className="lp-app-composer" aria-hidden="true">
          <span className="lp-app-plus">+</span>
          <span className="lp-app-typed">{t("mockTyped")}</span>
          <span className="lp-app-send"><Icon name="arrow" size={14} /></span>
        </div>
        <p className="lp-app-fine">{t("mockFine")}</p>
      </div>

      <aside className="lp-app-side" aria-label={t("mockAgent")}>
        <span className="lp-app-x" aria-hidden="true">×</span>
        <span className="lp-app-avatar" aria-hidden="true"><Icon name="case" size={30} /></span>
        <b className="lp-app-name">{t("mockAgent")}</b>
        <span className="lp-app-status"><span className="lp-dot-ok" aria-hidden="true" />{t("mockPrivate")}</span>
        <div className="lp-app-chips">
          <span>Claude Sonnet 5.5</span>
          <span>{t("mockMasked")}</span>
        </div>
        <p className="lp-app-today">{t("mockToday")}</p>
        <ul className="lp-app-done">
          {done.map((d) => (
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
