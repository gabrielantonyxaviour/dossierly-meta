"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/case/types";
import type { OnboardingState } from "@/lib/server/onboarding";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { MobileFlowHeader, MobilePage, ScreenTitle } from "@/components/ui";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n/client";
import { ONBOARDING_FLOW, SetupWizard, stepTitle } from "@/components/app/residence/start/SetupWizard";
import { wantsLetter } from "@/components/app/residence/start/YouExtra";
import { CaseFile } from "./CaseFile";
import "@/components/residence/residence.css";
import "@/components/app/residence/residence-app.css";

/**
 * Setup as a plain multi-step form (Gabriel, 18 Nov 2026: no voice here). Nine steps, one question group each;
 * every answer is saved to the server case and the step to the profile (and D1), so a refresh resumes on the same step. Mail, calendar,
 * forwarding and phone alerts are optional cards on the case home, not setup steps.
 */
export function OnboardingFlow({ initial, profile: initialProfile }: { initial: OnboardingState; profile: Profile }) {
  const t = useT("residence");
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  // The exact step lives in the profile; it counts only while D1 agrees (a restart sets D1 back to 1).
  const saved = initialProfile.setupStep;
  const [at, setAt] = useState(saved && Math.min(6, saved) === initial.step ? saved - 1 : 0);
  const [error, setError] = useState<string | null>(null);
  const id = ONBOARDING_FLOW[at]!;
  const [title, sub] = stepTitle(t, id, profile);

  // A review run (?again=1) restarts once; a refresh must not restart again.
  useEffect(() => { if (new URLSearchParams(window.location.search).has("again")) window.history.replaceState(null, "", "/onboarding"); }, []);
  const signIn = useCallback(() => router.push("/signin?next=%2Fonboarding"), [router]);

  const onStep = useCallback(async (i: number) => {
    const [r, p] = await Promise.all([flowApi.step(Math.min(6, i + 1)), flowApi.profile({ setupStep: i + 1 })]);
    const bad = !r.ok ? r : !p.ok ? p : null;
    if (bad) { if (bad.status === 401) signIn(); else setError(failure(bad) ?? t("saveFailed")); return false; }
    if (p.ok) setProfile(p.data);
    return true;
  }, [signIn, t]);
  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const r = await flowApi.profile(patch);
    if (!r.ok && r.status === 401) signIn();
    return r.ok ? r.data : null;
  }, [signIn]);
  const finish = async () => {
    const r = await flowApi.complete();
    if (!r.ok) { setError(failure(r) ?? t("saveFailed")); return; }
    router.push(wantsLetter(profile.situation === "letter") ? "/app/look" : "/app");
  };

  return (
    <main className="ob" data-screen={id}>
      <MobileFlowHeader title={t(`step_${id}`)} progress={{ at: at + 1, of: ONBOARDING_FLOW.length }} />
      <div className="ob-grid">
        <MobilePage actions="double" className="ob-talk">
          {at === 0 && <LanguagePicker compact className="ob-lang" />}
          <ScreenTitle title={title} sub={sub || undefined} />
          {error && <div className="ob-alert" role="alert"><p>{error}</p></div>}
          <SetupWizard flow={ONBOARDING_FLOW} profile={profile} setProfile={setProfile} start={at} onStep={onStep} saveProfile={saveProfile}
            onIndex={setAt} onFinish={finish} finishLabel={t("openCase")} fail={setError} />
        </MobilePage>
        <CaseFile profile={profile} step={at + 1} />
      </div>
    </main>
  );
}
