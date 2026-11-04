"use client";
import { useEffect, useState } from "react";
import type { Profile } from "@/lib/case/types";
import type { OnboardingState } from "@/lib/server/onboarding";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { CaseFile } from "./CaseFile";
import { InboxStep, type InboxPhase } from "./InboxStep";
import { Button, MobileFlowHeader, MobilePage, ScreenTitle } from "@/components/ui";
import { PhoneStep } from "./PhoneStep";
import { HelloScreen } from "./HelloScreen";
import { CityScreen, DetailsScreen, LanguageScreen, NameScreen, ReasonScreen, StageScreen } from "./Questions";
import { WelcomeStep } from "./WelcomeStep";
import { firstName, type Reason } from "./options";

/** One short question per screen. Several screens can share a server step (1: name + language, 4: city + details). */
const SCREENS = [
  { id: "hello", step: 1, title: "Welcome" }, { id: "name", step: 1, title: "About you" }, { id: "language", step: 1, title: "About you" },
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
    case "hello": return ["Hi, I’m Dossierly", "Tell me who you are and what’s going on. Just talk."];
    case "name": return ["What should I call you?", "I’m Dossierly, your caseworker for life in Poland."];
    case "language": return ["Which language should I speak?", "I’ll write and call you in it."];
    case "reason": return [`What brings you to Poland${name ? `, ${name}` : ""}?`, "It decides which residence rules apply to you."];
    case "stage": return ["Where is your permit now?", "I’ll start from where you are."];
    case "city": return ["Which city are you in?", "It tells me which office handles your case."];
    case "details": return [study ? "Which university?" : work ? "Who do you work for?" : "A few more details", "And when you arrived, if you know."];
    case "phone": return ["Can I call you when it’s urgent?", "Like a summons with a 14-day deadline."];
    case "inbox": return inbox === "calendar" ? ["Add these dates to your calendar", "You’ll get a reminder before each one."]
      : inbox === "saved" ? ["Saved to your case", "Everything you ticked is in your case now."]
      : inbox === "review" ? ["Found in your inbox", "Untick anything that’s wrong. Only ticked items are saved."]
      : inbox === "reading" ? ["Reading your inbox…", "Muse Spark reads each official email and notes where every fact came from."]
      : inbox === "empty" ? ["Nothing official yet", "I’ll read new letters when they arrive."]
      : ["Connect your Gmail", "Read-only. I look for letters from the office, MOS and your university."];
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
  const [auto, setAuto] = useState(false);
  const [found, setFound] = useState(0);
  const [calendarAdded, setCalendarAdded] = useState(false);
  const current = SCREENS[screen];
  const name = firstName(profile.fullName);

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
  /** Voice path: "Connect Gmail" goes straight to the Gmail consent; the remaining questions come from the inbox. */
  async function toEmail() {
    try { sessionStorage.setItem("ob-google-chain", "1"); } catch { /* private mode: one consent at a time */ }
    setAuto(true); setBusy(true); await move(SCREENS.findIndex((s) => s.id === "inbox")); setBusy(false);
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
  return (
    <main className="ob" data-screen={id}>
      {!welcome && <MobileFlowHeader title={current.title} progress={{ at: screen + 1, of: SCREENS.length }} back={screen > 0 && !busy ? () => void back() : undefined} />}
      <div className="ob-grid">
        <MobilePage actions="double" className="ob-talk" key={id}>
          <ScreenTitle title={say} sub={sub} />
          {error && <div className="ob-alert" role="alert"><p>{error.text}</p>{error.retry && <Button size="sm" onClick={error.retry}>Try again</Button>}</div>}
          {id === "welcome" ? <WelcomeStep firstName={name} calendarAdded={calendarAdded} />
            : id === "hello" ? <HelloScreen onProfile={setProfile} onEmail={() => void toEmail()} onType={() => void next()} />
            : id === "name" ? <NameScreen {...base} />
            : id === "language" ? <LanguageScreen {...base} />
            : id === "reason" ? <ReasonScreen {...base} reason={reason} setReason={setReason} />
            : id === "stage" ? <StageScreen {...base} answered={initial.step > 3 || state.step > 3 || !!profile.city} />
            : id === "city" ? <CityScreen {...base} />
            : id === "details" ? <DetailsScreen {...base} reason={reason} />
            : id === "inbox" ? <InboxStep returned={returned} auto={auto} stage={profile.stage} onPhase={setInbox}
                applyStage={async (stage) => { const r = await flowApi.profile({ stage }); if (r.ok) setProfile(r.data); return r.ok; }}
                setCalendarAdded={setCalendarAdded} onSkip={() => void next()} onDone={(saved) => { setFound(saved); void next(); }} />
            : <PhoneStep profile={profile} setProfile={setProfile} onDone={complete} />}
        </MobilePage>
        {!welcome && <CaseFile profile={profile} reason={reason} step={current.step} found={found} />}
      </div>
    </main>
  );
}
