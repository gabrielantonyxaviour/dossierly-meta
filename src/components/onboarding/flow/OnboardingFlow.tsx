"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/case/types";
import type { OnboardingState } from "@/lib/server/onboarding";
import { failure, flowApi } from "@/lib/client/onboarding-flow";
import { CaseFile } from "./CaseFile";
import { InboxStep, type InboxPhase } from "./InboxStep";
import { Button, MobileFlowHeader, MobilePage, ScreenTitle } from "@/components/ui";
import { PhoneStep } from "./PhoneStep";
import { HelloScreen } from "./HelloScreen";
import { LanguageScreen, NameScreen } from "./Questions";
import { WelcomeStep } from "./WelcomeStep";
import { firstName } from "./options";
import { START_IDS, StartScreen, startCopy, type StartId } from "./StartScreens";
import { OLD_TO_NEW } from "@/lib/residence/stage";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";

/**
 * One short question per screen. Several screens share a server step: 1 name + language, 2 situation + permit,
 * 3 dates + family, 4 the plan (stage 0 · Start of the residence case), then the optional extras: 5 mail, 6 alerts.
 */
const SCREENS = [
  { id: "hello", step: 1, title: "screenWelcome" }, { id: "name", step: 1, title: "screenAboutYou" }, { id: "language", step: 1, title: "screenAboutYou" },
  { id: "situation", step: 2, title: "screenPermit" }, { id: "ground", step: 2, title: "screenPermit" },
  { id: "dates", step: 3, title: "screenWhere" }, { id: "family", step: 3, title: "screenFamily" }, { id: "plan", step: 4, title: "screenPlan" },
  { id: "inbox", step: 5, title: "screenMail" }, { id: "phone", step: 6, title: "screenAlerts" },
] as const;
const isStart = (id: string): id is StartId => (START_IDS as readonly string[]).includes(id);
type ScreenId = (typeof SCREENS)[number]["id"];
const firstOf = (step: number) => SCREENS.findIndex((s) => s.step === step);

function copy(t: T, tr: T, id: ScreenId | "welcome", name: string, profile: Profile, inbox: InboxPhase): [string, string] {
  if (isStart(id)) return startCopy(tr, id, profile);
  switch (id) {
    case "welcome": return [name ? t("welcomeTitleNamed", { name }) : t("welcomeTitle"), t("welcomeSub")];
    case "hello": return [t("helloTitle"), t("helloSub")];
    case "name": return [t("nameTitle"), t("nameSub")];
    case "language": return [t("languageTitle"), t("languageSub")];
    case "phone": return [t("phoneTitle"), t("phoneSub")];
    case "inbox": return inbox === "calendar" ? [t("inboxCalendarTitle"), t("inboxCalendarSub")]
      : inbox === "saved" ? [t("inboxSavedTitle"), t("inboxSavedSub")]
      : inbox === "review" ? [t("inboxReviewTitle"), t("inboxReviewSub")]
      : inbox === "reading" ? [t("inboxReadingTitle"), t("inboxReadingSub")]
      : inbox === "empty" ? [t("inboxEmptyTitle"), t("inboxEmptySub")]
      : [t("inboxConnectTitle"), t("inboxConnectSub")];
  }
}

export function OnboardingFlow({ initial, profile: initialProfile, returned }: { initial: OnboardingState; profile: Profile; email: string | null; returned: string | null }) {
  const t = useT("onboarding");
  const tr = useT("residence");
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [profile, setProfile] = useState(initialProfile);
  const [screen, setScreen] = useState(Math.max(0, firstOf(initial.step)));
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
      if (!r.ok) { if (r.status === 401) signIn(); else setError({ text: failure(r) ?? t("errorProgress"), retry: () => void move(to) }); return; }
      setState(r.data.onboarding);
    }
    setError(null); setScreen(to);
  }
  async function next(patch?: Partial<Profile>) {
    setBusy(true); setError(null);
    if (patch) {
      const r = await flowApi.profile(patch);
      if (!r.ok) { setBusy(false); if (r.status === 401) signIn(); else setError({ text: failure(r) ?? t("errorAnswer"), retry: () => void next(patch) }); return; }
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
  /** The residence answers that build the case: without them the plan cannot be made. */
  const missingStart = () => !profile.situation ? "situation" : !profile.permitType || profile.permitType === "other" ? "ground" : !profile.voivodeship ? "dates" : null;
  /** After the mail step: unanswered case questions come first (the voice path skips them), then alerts. */
  async function afterInbox(saved?: number) {
    if (saved !== undefined) setFound(saved);
    const gap = missingStart();
    setBusy(true); await move(SCREENS.findIndex((s) => s.id === (gap ?? "phone"))); setBusy(false);
  }
  /** After the plan: the mail step unless it was already done on the voice path. */
  async function afterPlan() {
    setBusy(true); await move(SCREENS.findIndex((s) => s.id === (state.step >= 5 || found > 0 ? "phone" : "inbox"))); setBusy(false);
  }
  async function finishNow() {
    setError(null); setBusy(true);
    const r = await flowApi.complete();
    if (r.ok) router.push(profile.situation === "letter" ? "/app/look" : "/app");
    else { setBusy(false); setError({ text: failure(r) ?? t("errorFinish"), retry: () => void finishNow() }); }
  }
  async function back() { setBusy(true); await move(Math.max(0, screen - 1)); setBusy(false); }
  async function complete() {
    setError(null);
    const r = await flowApi.complete();
    if (r.ok) { setState(r.data.onboarding); setWelcome(true); }
    else setError({ text: failure(r) ?? t("errorFinish"), retry: () => void complete() });
  }

  const id: ScreenId | "welcome" = welcome ? "welcome" : current.id;
  const [say, sub] = copy(t, tr, id, name, profile, inbox);
  const headerTitle = current.title === "screenFamily" || current.title === "screenPlan" ? tr(current.title) : t(current.title);
  const base = { profile, busy, next };
  return (
    <main className="ob" data-screen={id}>
      {!welcome && <MobileFlowHeader title={headerTitle} progress={{ at: screen + 1, of: SCREENS.length }} back={screen > 0 && !busy ? () => void back() : undefined} />}
      <div className="ob-grid">
        <MobilePage actions="double" className="ob-talk" key={id}>
          <ScreenTitle title={say} sub={sub} />
          {error && <div className="ob-alert" role="alert"><p>{error.text}</p>{error.retry && <Button size="sm" onClick={error.retry}>{t("tryAgain")}</Button>}</div>}
          {id === "welcome" ? <WelcomeStep firstName={name} calendarAdded={calendarAdded} />
            : id === "hello" ? <HelloScreen onProfile={setProfile} onEmail={() => void toEmail()} onType={() => void next()} />
            : id === "name" ? <NameScreen {...base} />
            : id === "language" ? <LanguageScreen {...base} />
            : isStart(id) ? <StartScreen id={id} profile={profile} busy={busy} next={next} setProfile={setProfile} setBusy={setBusy}
                fail={(text, retry) => setError({ text, retry })} onExtras={() => void afterPlan()} onFinish={() => void finishNow()} />
            : id === "inbox" ? <InboxStep returned={returned} auto={auto} stage={profile.stage} onPhase={setInbox}
                applyStage={async (stage) => { const r = await flowApi.profile({ stage, residenceStage: OLD_TO_NEW[stage] }); if (r.ok) setProfile(r.data); return r.ok; }}
                setCalendarAdded={setCalendarAdded} onSkip={() => void afterInbox()} onDone={(saved) => void afterInbox(saved)} />
            : <PhoneStep profile={profile} setProfile={setProfile} onDone={complete} />}
        </MobilePage>
        {!welcome && <CaseFile profile={profile} step={current.step} found={found} />}
      </div>
    </main>
  );
}
