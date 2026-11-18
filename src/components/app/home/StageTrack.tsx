"use client";
import type { Case } from "@/lib/client/types";
import { useT } from "@/lib/i18n/client";

/** Labels are "home" message keys: track_<id>. */
const STAGES = [{ id: "apply" }, { id: "prints" }, { id: "letters" }, { id: "decision" }, { id: "card" }] as const;

/** Where the case stands, inferred from the case file. Done stages are filled; the current one is outlined. */
export function StageTrack({ c, letters }: { c: Case; letters: number }) {
  const t = useT("home");
  const today = new Date().toISOString().slice(0, 10);
  const text = (e: Case["events"][number]) => `${e.title} ${e.summary}`.toLowerCase();
  const has = (re: RegExp) => c.events.some((e) => re.test(text(e)));
  const done = [
    has(/mos|applied|wniosek|application/),
    has(/fingerprint|odcisk/),
    (letters > 0 || c.events.some((e) => e.kind === "letter")) && !c.deadlines.some((x) => x.date >= today),
    c.events.some((e) => /^(decision|decyzja)/i.test(e.title)),
    c.events.some((e) => /card collected|karta odebrana/i.test(e.title)),
  ];
  const current = done.findIndex((x) => !x);

  return (
    <section className="card stage" aria-label={t("caseStages")}>
      <ol className="stage-track">
        {STAGES.map((s, i) => {
          const state = done[i] ? "done" : i === current ? "now" : "later";
          return (
            <li key={s.id} className={`st-${state}`} aria-current={state === "now" ? "step" : undefined}>
              <span className="st-dot" aria-hidden="true" />
              <span className="st-label">{t(`track_${s.id}`)}</span>
              <span className="sr-only">{state === "done" ? t("stDone") : state === "now" ? t("stNow") : t("stLater")}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
