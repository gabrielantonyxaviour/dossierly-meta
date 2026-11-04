"use client";
import { useEffect, useState } from "react";
import { Avatar, Button, Card, ErrorState, Pill, Row, Section, Skeleton, TopBar, useToast } from "@/components/ui";
import { PERMIT_LABEL, STAGE_LABEL } from "../format";
import { useCaseData } from "../shell/case-data";
import { CHAT_KEY } from "../chat/useAgentChat";
import { AssistantSection } from "./AssistantSection";
import { ConnectionsSection } from "./ConnectionsSection";
import { PhoneSection } from "./PhoneSection";
import { ProfileSheet } from "./ProfileSheet";
import { PreviewTools, type PreviewFlow } from "./PreviewTools";
import "./settings.css";

export type AccountSettings = { email: string | null; callsEligible: boolean; sampleCase: boolean; previewFlow: PreviewFlow | null };

const LANG: Record<string, string> = { en: "English", pl: "Polski", hi: "हिन्दी", ta: "தமிழ்", uk: "Українська", ru: "Русский", es: "Español", ar: "العربية", tr: "Türkçe", vi: "Tiếng Việt" };
export const LANGS = Object.entries(LANG);

export function SettingsScreen() {
  const { snapshot, status, error, refresh } = useCaseData();
  const { toast } = useToast();
  const [account, setAccount] = useState<AccountSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    fetch("/api/account/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setAccount).catch(() => setAccount(null));
  }, []);
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="40%" /><Skeleton h={120} r={22} /><Skeleton h={220} r={22} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? "Settings didn’t load."} onRetry={() => void refresh()} /></div>;
  const p = snapshot.profile;
  const signOut = async () => {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      if (!res.ok) throw new Error();
      try { localStorage.removeItem(CHAT_KEY); localStorage.removeItem("dossierly:notices-read"); } catch { /* storage blocked */ }
      window.location.assign("/");
    } catch {
      setSigningOut(false);
      toast("Couldn’t sign out. Check your connection and retry.", { tone: "error" });
    }
  };
  return (
    <div className="sh-page st">
      <TopBar title="Settings" back={{ href: "/app", label: "Back to home" }} />
      <Card className="st-profile">
        <Avatar name={p.fullName} size={56} />
        <div className="st-profile-main">
          <b>{p.fullName ?? "Add your name"}</b>
          <span className="ui-meta">{account?.email ?? " "}</span>
          <span className="ui-meta">{[p.city, p.organisation].filter(Boolean).join(" · ") || "Poland"}</span>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
      </Card>

      <Section title="Your case">
        <Card flush>
          <Row icon="case" title={p.permitType ? PERMIT_LABEL[p.permitType] : "Residence case"} sub={STAGE_LABEL[p.stage]} href="/app/case" chevron />
          <Row icon="globe" title="Language" sub="Dossierly answers and speaks in this language" end={<span>{LANG[p.preferredLanguage] ?? p.preferredLanguage}</span>} onClick={() => setEditing(true)} />
          <Row icon="clock" title="Time zone" end={<span>Warsaw</span>} />
        </Card>
      </Section>

      <PhoneSection key={p.phone.number ?? "none"} profile={p} eligible={account?.callsEligible ?? false} loaded={account !== null} />
      <ConnectionsSection />
      <AssistantSection />

      <Section title="App">
        <Card flush>
          <Row icon="bell" title="Notifications" href="/app/notifications" chevron />
        </Card>
      </Section>

      <Section title="Privacy">
        <Card flush>
          <Row icon="shield" title="What Dossierly never does" sub="It never files applications, signs anything or logs into MOS or inPOL for you." />
          <Row icon="lock" title="Where your case lives" sub="On Dossierly’s servers in your private case file. Models: Meta Muse Spark, SAM 3.1, Muse Voice; speech by ElevenLabs." />
          <Row icon="book" title="Privacy policy" href="/legal/privacy" chevron />
          <Row icon="file" title="Terms" href="/legal/terms" chevron />
        </Card>
      </Section>

      {account?.previewFlow && <PreviewTools flow={account.previewFlow} />}
      {account?.sampleCase && <Pill tone="official">You are viewing the fictional sample case</Pill>}
      <Button variant="danger" block onClick={() => void signOut()} loading={signingOut} icon="out">Sign out</Button>
      <p className="ui-meta st-foot">Dossierly guides you. It isn’t a law firm and doesn’t give legal advice.</p>
      <ProfileSheet key={editing ? "open" : "closed"} open={editing} onClose={() => setEditing(false)} profile={p} />
    </div>
  );
}
