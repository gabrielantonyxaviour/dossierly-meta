"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CaseSnapshot, Profile } from "@/lib/case/types";
import { useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";
import { CASE_FLOW, SetupWizard, stepTitle } from "./start/SetupWizard";

/* Stage 0 · Start inside the app: the case questions of setup, for cases set up before the residence flow or to
   change an answer. It opens on the first unanswered question; each answer is saved before moving on. */

export function StartStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const router = useRouter();
  const { patchProfile, refresh } = useCaseData();
  const [profile, setProfile] = useState<Profile>(c.profile);
  const [error, setError] = useState<string | null>(null);
  const p = c.profile;
  const gap = [!p.situation, !p.permitType || p.permitType === "other", !p.voivodeship, !p.legalStayUntil && p.situation !== "letter", !p.employerPays].findIndex(Boolean);
  const [at, setAt] = useState(gap < 0 ? 0 : gap);
  const [title, sub] = stepTitle(t, CASE_FLOW[at]!, profile);
  return (
    <>
      <div className="rp-stack">
        <h2 className="rp-h1">{title}</h2>
        {sub && <p className="rp-lead">{sub}</p>}
      </div>
      {error && <p className="rs-err" role="alert">{error}</p>}
      <SetupWizard flow={CASE_FLOW} profile={profile} setProfile={setProfile} start={at} onIndex={setAt} fail={setError}
        saveProfile={(patch) => patchProfile(patch)} finishLabel={t("openCase")}
        onFinish={async () => { await refresh(); router.push(profile.situation === "letter" ? "/app/look" : "/app"); }} />
    </>
  );
}
