"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import type { CaseSnapshot, Profile } from "@/lib/case/types";
import { VOIVODESHIP_INFO } from "@/lib/residence/model";
import { useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";
import { Continue, DatesStep, GroundStep, SituationStep, StartStepper } from "./start/StartSteps";
import { FamilyStep, PlanSummary } from "./start/FamilyPlan";
import { useResidence } from "./useResidence";

/* Stage 0 · Start inside the app: the same five questions as onboarding, for cases set up before the residence
   flow or to change an answer. Each answer is saved before moving on, so a reload resumes with it. */

const TITLES = [["sitTitle", "sitSub"], ["groundTitle", "groundSub"], ["datesTitle", "datesSub"], ["familyTitle", "familySub"], ["planTitle", ""]] as const;

export function StartStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const router = useRouter();
  const { patchProfile } = useCaseData();
  const { act, busy: acting } = useResidence();
  const { toast } = useToast();
  const p = c.profile;
  const firstGap = !p.situation ? 0 : !p.permitType || p.permitType === "other" ? 1 : !p.voivodeship ? 2 : 0;
  const [at, setAt] = useState(firstGap);
  const [saving, setSaving] = useState(false);
  const busy = saving || acting;
  const go = (n: number) => { setAt(n); window.scrollTo({ top: 0 }); };
  async function save(patch: Partial<Profile>) {
    setSaving(true);
    const ok = await patchProfile(patch);
    setSaving(false);
    if (ok) go(at + 1);
    else toast(t("saveFailed"), { tone: "error" });
  }
  const [title, sub] = TITLES[at]!;
  return (
    <>
      <StartStepper at={at} />
      <div className="rp-stack">
        <h2 className="rp-h1">{at === 1 && p.situation === "family" ? t("groundTitleFamily") : t(title)}</h2>
        {sub && <p className="rp-lead">{t(sub)}</p>}
      </div>
      {at === 0 ? <SituationStep profile={p} busy={busy} onNext={(situation) => void save({ situation })} />
        : at === 1 ? <GroundStep profile={p} busy={busy} onNext={(x) => void save(x)} />
        : at === 2 ? <DatesStep profile={p} busy={busy} onNext={(x) => void save({ ...x, ...(p.city ? {} : { city: VOIVODESHIP_INFO[x.voivodeship].seat }) })} />
        : at === 3 ? <FamilyStep profile={p} busy={busy} onNext={(members) => void act({ action: "household", members }).then((ok) => ok && go(4))} />
        : (
          <div className="ob-answer">
            <PlanSummary profile={p} />
            <Continue busy={busy} label={t("openCase")}
              onClick={() => void act({ action: "stage", stage: p.situation === "letter" ? "waiting" : "prepare" }).then((ok) => ok && router.push(p.situation === "letter" ? "/app/look" : "/app"))} />
          </div>
        )}
      {at > 0 && <Button variant="ghost" icon="back" disabled={busy} onClick={() => go(at - 1)}>{t("back")}</Button>}
    </>
  );
}
