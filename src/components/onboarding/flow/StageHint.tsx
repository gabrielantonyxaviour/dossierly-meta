"use client";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/case/types";
import type { Finding } from "@/lib/onboarding/findings";
import { STAGES } from "./options";
import { useT } from "@/lib/i18n/client";
import { tNow } from "@/lib/i18n/current";
import type { T } from "@/lib/i18n/translate";

const ORDER = STAGES.map((s) => s.id);

/** What the confirmed mail says about the stage, when it is further along than what the person chose. */
export function suggestedStage(findings: Finding[], current: Profile["stage"], t: T = tNow("onboarding")): { stage: Profile["stage"]; why: string } | null {
  const fact = (k: string) => findings.find((f) => f.kind === "fact" && f.key === k);
  const decision = fact("inpolStatus");
  const filed = fact("filedAt");
  const s: { stage: Profile["stage"]; why: string } | null =
    decision?.kind === "fact" && /decision (issued|granted|made)|decyzj/i.test(decision.value) && !/expected/i.test(decision.value) ? { stage: "decision_received", why: decision.value }
    : filed?.kind === "fact" ? { stage: "waiting_decision", why: t("filedOn", { date: filed.value }) }
    : null;
  return s && ORDER.indexOf(s.stage) > ORDER.indexOf(current) ? s : null;
}

/** `auto`: the stage was never asked (voice setup), so the mail sets it and the card just says so. */
export function StageHint({ hint, apply, auto }: { hint: { stage: Profile["stage"]; why: string }; apply(stage: Profile["stage"]): Promise<boolean>; auto?: boolean }) {
  const t = useT("onboarding");
  const [state, setState] = useState<"ask" | "busy" | "done" | "kept" | "error">(auto ? "busy" : "ask");
  const once = useRef(false);
  useEffect(() => {
    if (!auto || once.current) return;
    once.current = true;
    void apply(hint.stage).then((ok) => setState(ok ? "done" : "error"));
  }, [auto, apply, hint.stage]);
  const key = STAGES.find((s) => s.id === hint.stage)?.title;
  const label = key ? t(key) : hint.stage;
  if (state === "kept") return null;
  return (
    <div className="ob-note ob-hint-card" role="status">
      <strong>{state === "done" ? t("stageUpdated", { stage: label }) : t("furtherAlong")}</strong>
      {state === "done" && auto && <p>{hint.why}.</p>}
      {state !== "done" && !auto && <p>{hint.why}. {t("setStageAsk", { stage: label })}</p>}
      {state === "error" && <p className="ob-field-err">{t("saveFailed")}</p>}
      {state !== "done" && (!auto || state === "error") && <div className="ob-hint-actions">
        <button type="button" className="ui-btn ui-btn--primary" disabled={state === "busy"} onClick={async () => { setState("busy"); setState((await apply(hint.stage)) ? "done" : "error"); }}>{t("updateStage")}</button>
        <button type="button" className="ui-btn ui-btn--ghost" disabled={state === "busy"} onClick={() => setState("kept")}>{t("keepAsIs")}</button>
      </div>}
    </div>
  );
}
