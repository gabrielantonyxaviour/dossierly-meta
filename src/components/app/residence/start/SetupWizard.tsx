"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/case/types";
import { residenceAction } from "@/lib/client/residence";
import { call } from "@/lib/client/api";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_COOKIE } from "@/lib/i18n/locales";
import type { T } from "@/lib/i18n/translate";
import { EmployerStep, ExpiryStep, GroundStep, RegionStep, SituationStep, StartNav, StartStepper, Continue } from "./StartSteps";
import { FamilyStep, PlanSummary, type MemberDraft } from "./FamilyPlan";
import { ExtraStep, YouStep } from "./YouExtra";

/*
 * The setup wizard (ReUI Wizard-1). Onboarding runs all nine steps; the in-app /app/residence/start runs the case
 * questions only. Every answer is saved server-side before the next step shows, and the step itself is recorded
 * (onboarding), so a refresh resumes where the person was.
 */

export type StepId = "situation" | "ground" | "region" | "expiry" | "employer" | "family" | "you" | "extra" | "plan";
export const ONBOARDING_FLOW: StepId[] = ["situation", "ground", "region", "expiry", "employer", "family", "you", "extra", "plan"];
export const CASE_FLOW: StepId[] = ["situation", "ground", "region", "expiry", "employer", "family", "plan"];

const LABEL: Record<StepId, string> = {
  situation: "stepSituation", ground: "stepPermit", region: "stepRegion", expiry: "stepExpiry", employer: "stepEmployer",
  family: "stepFamily", you: "stepYou", extra: "stepExtra", plan: "stepPlan",
};

export function stepTitle(t: T, id: StepId, p: Profile): [string, string] {
  switch (id) {
    case "situation": return [t("sitTitle"), t("sitSub")];
    case "ground": return [p.situation === "family" ? t("groundTitleFamily") : t("groundTitle"), t("groundSub")];
    case "region": return [t("regionTitle"), t("regionSub")];
    case "expiry": return [p.situation === "first" ? t("expiryTitleVisa") : t("expiryTitle"), t("expirySub")];
    case "employer": return [t("employerTitle"), t("employerSub")];
    case "family": return [t("familyTitle"), t("familySub")];
    case "you": return [t("youTitle"), t("youSub")];
    case "extra": return [t("extraTitle"), t("extraSub")];
    case "plan": return [t("planTitle"), ""];
  }
}

type Props = {
  flow: StepId[];
  profile: Profile;
  setProfile: (p: Profile) => void;
  /** Index to start at (onboarding: the saved step). */
  start: number;
  /** Records the step server-side before it shows; false keeps the person where they are. */
  onStep?: (index: number) => Promise<boolean>;
  /** Saves a profile patch; null on failure. */
  saveProfile: (patch: Partial<Profile>) => Promise<Profile | null>;
  /** Called with the step about to show (header title and progress). */
  onIndex?: (index: number) => void;
  onFinish: () => Promise<void>;
  finishLabel: string;
  fail: (text: string | null) => void;
};

export function SetupWizard({ flow, profile, setProfile, start, onStep, saveProfile, onIndex, onFinish, finishLabel, fail }: Props) {
  const t = useT("residence");
  const ui = useLocale();
  const [at, setAt] = useState(Math.min(Math.max(0, start), flow.length - 1));
  const [busy, setBusy] = useState(false);
  const id = flow[at]!;
  useEffect(() => { onIndex?.(at); window.scrollTo({ top: 0 }); }, [at, onIndex]);

  async function go(to: number) {
    if (onStep && !(await onStep(to))) return false;
    fail(null);
    setAt(to);
    return true;
  }
  /** Runs one save, then moves forward. */
  async function step(save: () => Promise<boolean>) {
    setBusy(true);
    const ok = await save();
    if (ok) await go(at + 1);
    setBusy(false);
  }
  const patch = (p: Partial<Profile>) => step(async () => {
    const r = await saveProfile(p);
    if (!r) { fail(t("saveFailed")); return false; }
    setProfile(r);
    return true;
  });
  const household = (members: MemberDraft[]) => step(async () => {
    const r = await residenceAction({ action: "household", members });
    if (!r.ok) { fail(r.status === 0 ? t("offline") : t("saveFailed")); return false; }
    setProfile(r.data.profile);
    return true;
  });
  const you = (p: { fullName: string; preferredLanguage: string }) => step(async () => {
    const r = await saveProfile({ ...p, country: "PL" });
    if (!r) { fail(t("saveFailed")); return false; }
    setProfile(r);
    if (p.preferredLanguage !== ui) {
      // The interface follows the chosen language: record the next step first, so the reload resumes there.
      if (onStep && !(await onStep(at + 1))) return false;
      document.cookie = `${LOCALE_COOKIE}=${p.preferredLanguage}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
      window.location.reload();
      return false;
    }
    return true;
  });
  const extra = (p: { note: string }) => step(async () => {
    if (!p.note) return true;
    const r = await call("/api/case/events", { method: "POST", body: JSON.stringify({ type: "note", summary: `Told Dossierly at setup: ${p.note}`.slice(0, 600) }) });
    if (!r.ok) { fail(r.status === 0 ? t("offline") : t("saveFailed")); return false; }
    return true;
  });
  const finish = async () => {
    setBusy(true);
    const r = await residenceAction({ action: "stage", stage: profile.situation === "letter" ? "waiting" : "prepare" });
    if (!r.ok) { setBusy(false); fail(r.status === 0 ? t("offline") : t("saveFailed")); return; }
    setProfile(r.data.profile);
    await onFinish();
    setBusy(false);
  };

  const p = profile;
  const back = at > 0 ? () => { if (!busy) { setBusy(true); void go(at - 1).finally(() => setBusy(false)); } } : undefined;
  return (
    <StartNav.Provider value={{ back }}>
      <StartStepper at={at} labels={flow.map((s) => t(LABEL[s]))} />
      {id === "situation" ? <SituationStep key={id} profile={p} busy={busy} onNext={(situation) => void patch({ situation })} />
        : id === "ground" ? <GroundStep key={id} profile={p} busy={busy} onNext={(x) => void patch(x)} />
        : id === "region" ? <RegionStep key={id} profile={p} busy={busy} onNext={(x) => void patch(x)} />
        : id === "expiry" ? <ExpiryStep key={id} profile={p} busy={busy} onNext={(x) => void patch(x)} />
        : id === "employer" ? <EmployerStep key={id} profile={p} busy={busy} onNext={(x) => void patch(x)} />
        : id === "family" ? <FamilyStep key={id} profile={p} busy={busy} onNext={(m) => void household(m)} />
        : id === "you" ? <YouStep key={id} profile={p} busy={busy} onNext={(x) => void you(x)} />
        : id === "extra" ? <ExtraStep key={id} profile={p} busy={busy} onNext={(x) => void extra(x)} />
        : (
          <div className="ob-answer">
            <PlanSummary profile={p} />
            <Continue busy={busy} label={finishLabel} onClick={() => void finish()} />
          </div>
        )}
    </StartNav.Provider>
  );
}
