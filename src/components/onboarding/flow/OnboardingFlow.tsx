"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/case/types";
import type { OnboardingState } from "@/lib/server/onboarding";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { CaseFile } from "./CaseFile";
import { InboxStep, type InboxPhase } from "./InboxStep";
import { FlowHeader, useKeyboardInset } from "./mobile";
import { PhoneStep } from "./PhoneStep";
import { CityScreen, DetailsScreen, LanguageScreen, NameScreen, ReasonScreen, StageScreen } from "./Questions";
import { WelcomeStep } from "./WelcomeStep";
import { firstName, type Reason } from "./options";

/** One short question per screen. Several screens can share a server step (1: name + language, 4: city + details). */
const SCREENS = [
  { id: "name", step: 1, title: "About you" }, { id: "language", step: 1, title: "About you" },
  { id: "reason", step: 2, title: "Your permit" }, { id: "stage", step: 3, title: "Your permit" },
  { id: "city", step: 4, title: "Where you live" }, { id: "details", step: 4, title: "Where you live" },
  { id: "inbox", step: 5, title: "Official mail" }, { id: "phone", step: 6, title: "Alerts" },
] as const;
type ScreenId = (typeof SCREENS)[number]["id"];
const firstOf = (step: number) => SCREENS.findIndex((s) => s.step === step);

function copy(id: ScreenId | "welcome", name: string, profile: Profile, inbox: InboxPhase): [string, string] {
  const study = profile.permitType === "temporary_residence_study", work = profile.permitType === "temporary_residence_work";
  switch (id) {
    case "welcome": return [`Your case is ready${name ? `, ${name}` : ""}`, "Let me tell you what I found. It takes a minute."];
    case "name": return ["What should I call you?", "I’m Dossierly, your caseworker for life in Poland."];
    case "language": return ["Which language should I speak?", "I’ll write and call you in it."];
    case "reason": return [`What brings you to Poland${name ? `, ${name}` : ""}?`, "It decides which residence rules apply to you."];
    case "stage": return ["Where is your permit now?", "I’ll start from where you are."];
    case "city": return ["Which city are you in?", "It tells me which office handles your case."];
    case "details": return [study ? "Which university?" : work ? "Who do you work for?" : "A few more details", "And when you arrived, if you know."];
    case "phone": return ["Can I call you when it’s urgent?", "Like a summons with a 14-day deadline."];
    case "inbox": return inbox === "review" ? ["Here’s what I found", "Untick anything that’s wrong. Only ticked items are saved."]
      : inbox === "reading" ? ["Reading your official mail", "Muse Spark reads each email and notes where every fact came from."]
      : inbox === "empty" ? ["Nothing official yet", "I’ll read new letters when they arrive."]
      : ["Let me read your official mail", "Read-only. I look for the office, MOS and your university."];
  }
}

export function OnboardingFlow({ initial, profile: initialProfile, returned }: { initial: OnboardingState; profile: Profile; email: string | null; returned: string | null }) {
  const [state, setState] = useState(initial);
  const [profile, setProfile] = useState(initialProfile);
  const [screen, setScreen] = useState(Math.max(0, firstOf(initial.step)));
  const [reason, setReason] = useState<Reason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [welcome, setWelcome] = useState(initial.status === "completed");
  const [inbox, setInbox] = useState<InboxPhase>("connect");
  const [found, setFound] = useState(0);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const current = SCREENS[screen];
  const name = firstName(profile.fullName);
  useKeyboardInset();

  // A review run (?again=1) restarts once; a refresh must not restart again.
  useEffect(() => { if (new URLSearchParams(window.location.search).has("again")) window.history.replaceState(null, "", "/onboarding"); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [screen, welcome, inbox]);

  const signIn = () => window.location.assign("/signin?next=%2Fonboarding");
  /** Moves to another screen, recording the server step when it changes. */
  async function move(to: number) {
    const target = SCREENS[to];
    if (target.step !== SCREENS[screen].step || target.step !== state.step) {
      const r = await flowApi.step(target.step);
      if (!r.ok) { if (r.status === 401) signIn(); else setError({ text: failure(r) ?? "Could not save your progress.", retry: () => void move(to) }); return; }
      setState(r.data.onboarding);
    }
    setError(null); setScreen(to);
  }
  async function next(patch?: Partial<Profile>) {
    setBusy(true); setError(null);
    if (patch) {
      const r = await flowApi.profile(patch);
      if (!r.ok) { setBusy(false); if (r.status === 401) signIn(); else setError({ text: failure(r) ?? "Could not save that answer.", retry: () => void next(patch) }); return; }
      setProfile(r.data);
    }
    await move(Math.min(screen + 1, SCREENS.length - 1));
    setBusy(false);
  }
  async function back() { setBusy(true); await move(Math.max(0, screen - 1)); setBusy(false); }
  async function complete() {
    setError(null);
    const r = await flowApi.complete();
    if (r.ok) { setState(r.data.onboarding); setWelcome(true); }
    else setError({ text: failure(r) ?? "Could not finish setup.", retry: () => void complete() });
  }

  const id: ScreenId | "welcome" = welcome ? "welcome" : current.id;
  const [say, sub] = copy(id, name, profile, inbox);
  const base = { profile, busy, next };
  const inReview = id === "inbox" && inbox === "review";
  return (
    <main className="ob" data-screen={id}>
      {!welcome && <FlowHeader title={current.title} progress={(screen + (inReview ? 0.6 : 0)) / SCREENS.length + 1 / SCREENS.length} onBack={screen > 0 ? () => void back() : undefined} disabled={busy} />}
      <div className="ob-grid">
        <section className="ob-talk" key={id}>
          <h1 className="ob-say">{say}</h1>
          <p className="ob-sub">{sub}</p>
          {error && <div className="ob-alert" role="alert"><p>{error.text}</p>{error.retry && <button type="button" className="ui-btn ui-btn--sm" onClick={error.retry}>Try again</button>}</div>}
          {id === "welcome" ? <WelcomeStep firstName={name} calendarAdded={calendarAdded} />
            : id === "name" ? <NameScreen {...base} />
            : id === "language" ? <LanguageScreen {...base} />
            : id === "reason" ? <ReasonScreen {...base} reason={reason} setReason={setReason} />
            : id === "stage" ? <StageScreen {...base} answered={initial.step > 3 || state.step > 3} />
            : id === "city" ? <CityScreen {...base} />
            : id === "details" ? <DetailsScreen {...base} reason={reason} />
            : id === "inbox" ? <InboxStep returned={returned} stage={profile.stage} onPhase={setInbox}
                applyStage={async (stage) => { const r = await flowApi.profile({ stage }); if (r.ok) setProfile(r.data); return r.ok; }}
                setCalendarAdded={setCalendarAdded} onSkip={() => void next()} onDone={(saved) => { setFound(saved); void next(); }} />
            : <PhoneStep profile={profile} setProfile={setProfile} onDone={complete} />}
        </section>
        {!welcome && <CaseFile profile={profile} reason={reason} step={current.step} found={found} />}
      </div>
    </main>
  );
}
