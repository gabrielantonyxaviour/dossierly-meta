"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/case/types";
import type { OnboardingState } from "@/lib/server/onboarding";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { Logo } from "@/components/Logo";
import { CaseFile } from "./CaseFile";
import { InboxStep } from "./InboxStep";
import { PhoneStep } from "./PhoneStep";
import { PlaceStep, ReasonStep, StageStep, YouStep } from "./Questions";
import { WelcomeStep } from "./WelcomeStep";
import { firstName, type Reason } from "./options";

const TOTAL = 6;
function copy(step: number, name: string, welcome: boolean): [string, string] {
  if (welcome) return [`Your case is ready${name ? `, ${name}` : ""}`, "Before you look around, I’d like to tell you what I found. It takes about a minute."];
  return ([
    ["Hi, I’m Dossierly.", "I’ll be your caseworker for life in Poland: your letters, dates and office visits in one place. Setup takes about two minutes. First, who are you?"],
    [`Nice to meet you${name ? `, ${name}` : ""}. What brings you to Poland?`, "This decides which residence rules I follow for you."],
    ["Where are you with your residence permit?", "I’ll pick up exactly where you are, not from the beginning."],
    ["Where are you based?", "Your city tells me which voivodeship office handles your case."],
    ["Let me read your official mail.", "Connect Gmail and I’ll find what MOS, the office and your university sent you. Then I’ll put the dates in your Google Calendar."],
    ["Can I call you when something urgent arrives?", "Like a summons with a 14-day deadline. I’ll explain it in your language."],
  ] as [string, string][])[step - 1];
}

export function OnboardingFlow({ initial, profile: initialProfile, email, returned }: { initial: OnboardingState; profile: Profile; email: string | null; returned: string | null }) {
  const [state, setState] = useState(initial);
  const [profile, setProfile] = useState(initialProfile);
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [welcome, setWelcome] = useState(initial.status === "completed");
  const [found, setFound] = useState(0);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const step = state.step;
  const name = firstName(profile.fullName);

  useEffect(() => { document.getElementById("ob-say")?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [step, welcome]);

  async function go(next: number) {
    const r = await flowApi.step(next);
    if (r.ok) { setState(r.data.onboarding); return true; }
    if (r.status === 401) { window.location.assign("/signin?next=%2Fonboarding"); return false; }
    setError({ text: failure(r) ?? "Could not save your progress.", retry: () => void go(next) }); return false;
  }
  async function save(patch: Partial<Profile>) {
    setBusy(true); setError(null);
    const r = await flowApi.profile(patch);
    if (r.ok) { setProfile(r.data); await go(step + 1); }
    else if (r.status === 401) window.location.assign("/signin?next=%2Fonboarding");
    else setError({ text: failure(r) ?? "Could not save that answer.", retry: () => void save(patch) });
    setBusy(false);
  }
  async function complete() {
    setError(null);
    const r = await flowApi.complete();
    if (r.ok) { setState(r.data.onboarding); setWelcome(true); }
    else setError({ text: failure(r) ?? "Could not finish setup.", retry: () => void complete() });
  }

  const [say, sub] = copy(step, name, welcome);
  const base = { profile, busy, save };
  return (
    <main className="ob" data-step={welcome ? "welcome" : step}>
      <header className="ob-top">
        <Link href="/" prefetch={false} aria-label="Dossierly home"><Logo size={24} /></Link>
        {!welcome && <div className="ob-steps" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={TOTAL} aria-valuenow={step}>
          {Array.from({ length: TOTAL }, (_, i) => <span key={i} data-on={i < step} />)}
        </div>}
        <span className="ob-who">{email ?? "Signed in"}</span>
      </header>
      <div className="ob-grid">
        <section className="ob-talk" key={welcome ? "w" : step}>
          <div className="ob-agent"><span className="ob-agent-dot" aria-hidden="true" /><span>Dossierly{welcome ? "" : ` · step ${step} of ${TOTAL}`}</span></div>
          <h1 id="ob-say" tabIndex={-1} className="ob-say">{say}</h1>
          <p className="ob-sub">{sub}</p>
          {error && <div className="ob-alert" role="alert"><p>{error.text}</p>{error.retry && <button type="button" className="btn btn-small" onClick={error.retry}>Try again</button>}</div>}
          {welcome ? <WelcomeStep firstName={name} calendarAdded={calendarAdded} />
            : step === 1 ? <YouStep {...base} />
            : step === 2 ? <ReasonStep {...base} reason={reason} setReason={setReason} />
            : step === 3 ? <StageStep {...base} answered={initial.step > 3} />
            : step === 4 ? <PlaceStep {...base} reason={reason} />
            : step === 5 ? <InboxStep returned={returned} setCalendarAdded={setCalendarAdded} onSkip={() => void go(6)} onDone={(saved) => { setFound(saved); void go(6); }} />
            : <PhoneStep profile={profile} setProfile={setProfile} onDone={complete} />}
          {!welcome && step > 1 && <button type="button" className="ob-back" disabled={busy} onClick={() => void go(step - 1)}>← Back</button>}
        </section>
        {!welcome && <CaseFile profile={profile} reason={reason} step={step} found={found} />}
      </div>
    </main>
  );
}
