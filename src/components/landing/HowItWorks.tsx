import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { getT } from "@/lib/i18n/server";
import type { T } from "@/lib/i18n/translate";
import { LetterMock, MeetMock, PrepareMock, WrapUpMock } from "./HiwMocks";

type Step = {
  id: string; tab: string; icon: IconName; eyebrow: string; title: string; body: string;
  features: { icon: IconName; name: string; desc: string }[]; caption: string; visual: ReactNode;
};

const steps = (t: T): Step[] => [
  {
    id: "prepare", tab: t("tabBefore"), icon: "prepare", eyebrow: t("prepEyebrow"),
    title: t("prepTitle"),
    body: t("prepBody"),
    features: [
      { icon: "link", name: t("prepF1"), desc: t("prepF1d") },
      { icon: "speak", name: t("prepF2"), desc: t("prepF2d") },
    ],
    caption: t("prepCaption"),
    visual: <PrepareMock t={t} />,
  },
  {
    id: "meet", tab: t("tabDuring"), icon: "meet", eyebrow: t("meetEyebrow"),
    title: t("meetTitle"),
    body: t("meetBody"),
    features: [
      { icon: "mic", name: t("meetF1"), desc: t("meetF1d") },
      { icon: "shield", name: t("meetF2"), desc: t("meetF2d") },
    ],
    caption: t("meetCaption"),
    visual: <MeetMock t={t} />,
  },
  {
    id: "wrap", tab: t("tabAfter"), icon: "check", eyebrow: t("wrapEyebrow"),
    title: t("wrapTitle"),
    body: t("wrapBody"),
    features: [
      { icon: "calendar", name: t("wrapF1"), desc: t("wrapF1d") },
      { icon: "case", name: t("wrapF2"), desc: t("wrapF2d") },
    ],
    caption: t("wrapCaption"),
    visual: <WrapUpMock t={t} />,
  },
  {
    id: "letters", tab: t("tabLetters"), icon: "letter", eyebrow: t("letEyebrow"),
    title: t("letTitle"),
    body: t("letBody"),
    features: [
      { icon: "camera", name: t("letF1"), desc: t("letF1d") },
      { icon: "link", name: t("letF2"), desc: t("letF2d") },
      { icon: "file", name: t("letF3"), desc: t("letF3d") },
    ],
    caption: t("letCaption"),
    visual: <LetterMock t={t} />,
  },
];

/** How it works: sticky tabs, steps on the left, one sticky visual on the right that follows the step. */
export async function HowItWorks() {
  const t = await getT("landing");
  const STEPS = steps(t);
  return (
    <section className="lp-sec" id="how" aria-labelledby="how-h">
      <div className="lp-wrap">
        <header className="lp-head-c">
          <h2 id="how-h" className="lp-h2" data-sweep>{t("howTitle")}</h2>
          <p className="lp-body">{t("howBody")}</p>
        </header>
        <nav className="lp-tabs" aria-label={t("howSteps")}>
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
