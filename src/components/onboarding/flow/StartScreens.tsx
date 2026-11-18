"use client";
import type { Profile } from "@/lib/case/types";
import { residenceAction } from "@/lib/client/residence";
import { VOIVODESHIP_INFO } from "@/lib/residence/model";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { DatesStep, GroundStep, SituationStep, StartStepper, Continue } from "@/components/app/residence/start/StartSteps";
import { FamilyStep, PlanSummary, type MemberDraft } from "@/components/app/residence/start/FamilyPlan";
import "@/components/residence/residence.css";
import "@/components/app/residence/residence-app.css";

/* Stage 0 · Start inside onboarding: the five residence questions after name and language. */

export const START_IDS = ["situation", "ground", "dates", "family", "plan"] as const;
export type StartId = (typeof START_IDS)[number];

/** Title and line under it, from the "residence" namespace. */
export function startCopy(t: T, id: StartId, profile: Profile): [string, string] {
  switch (id) {
    case "situation": return [t("sitTitle"), t("sitSub")];
    case "ground": return [profile.situation === "family" ? t("groundTitleFamily") : t("groundTitle"), t("groundSub")];
    case "dates": return [t("datesTitle"), t("datesSub")];
    case "family": return [t("familyTitle"), t("familySub")];
    case "plan": return [t("planTitle"), ""];
  }
}

type Props = {
  id: StartId;
  profile: Profile;
  busy: boolean;
  /** Saves a profile patch and moves on (onboarding's `next`). */
  next: (patch?: Partial<Profile>) => Promise<void>;
  setProfile: (p: Profile) => void;
  setBusy: (b: boolean) => void;
  fail: (text: string, retry: () => void) => void;
  /** Plan screen: continue to the optional extras, or finish now. */
  onExtras: () => void;
  onFinish: () => void;
};

export function StartScreen({ id, profile, busy, next, setProfile, setBusy, fail, onExtras, onFinish }: Props) {
  const t = useT("residence");
  async function household(members: MemberDraft[]) {
    setBusy(true);
    const r = await residenceAction({ action: "household", members });
    if (!r.ok) { setBusy(false); fail(r.error || t("saveFailed"), () => void household(members)); return; }
    setProfile(r.data.profile);
    setBusy(false);
    await next();
  }
  async function plan(go: () => void) {
    setBusy(true);
    const stage = profile.situation === "letter" ? "waiting" : "prepare";
    const r = await residenceAction({ action: "stage", stage });
    setBusy(false);
    if (!r.ok) { fail(r.error || t("saveFailed"), () => void plan(go)); return; }
    setProfile(r.data.profile);
    go();
  }
  const at = START_IDS.indexOf(id);
  return (
    <>
      <StartStepper at={at} />
      {id === "situation" ? <SituationStep profile={profile} busy={busy} onNext={(situation) => void next({ situation })} />
        : id === "ground" ? <GroundStep profile={profile} busy={busy} onNext={(p) => void next(p)} />
        : id === "dates" ? <DatesStep profile={profile} busy={busy} onNext={(p) => void next({ ...p, ...(profile.city ? {} : { city: VOIVODESHIP_INFO[p.voivodeship].seat }) })} />
        : id === "family" ? <FamilyStep profile={profile} busy={busy} onNext={(m) => void household(m)} />
        : (
          <div className="ob-answer">
            <PlanSummary profile={profile} />
            <p className="rp-note">{t("extrasNote")}</p>
            <Continue busy={busy} onClick={() => void plan(onExtras)} label={t("continue")}
              secondary={<Button variant="ghost" disabled={busy} onClick={() => void plan(onFinish)}>{t("skipOpenCase")}</Button>} />
          </div>
        )}
    </>
  );
}
