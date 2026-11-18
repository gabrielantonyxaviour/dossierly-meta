"use client";
import { useEffect, useState } from "react";
import { Avatar, Button, Card, ErrorState, Row, Section, Skeleton, TopBar, useToast } from "@/components/ui";
import { LanguagePicker } from "@/components/LanguagePicker";
import { useT } from "@/lib/i18n/client";
import { permitLabel, stageLabel } from "../format";
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
  const t = useT("settings");
  const tc = useT("common");
  const { toast } = useToast();
  const [account, setAccount] = useState<AccountSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    fetch("/api/account/settings", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setAccount).catch(() => setAccount(null));
  }, []);
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="40%" /><Skeleton h={120} r={22} /><Skeleton h={220} r={22} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? t("loadFailed")} onRetry={() => void refresh()} /></div>;
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
      toast(t("signOutFailed"), { tone: "error" });
    }
  };
  return (
    <div className="sh-page st">
      <TopBar title={t("title")} back={{ href: "/app", label: t("backHome") }} />
      <Card className="st-profile">
        <Avatar name={p.fullName} size={56} />
        <div className="st-profile-main">
          <b>{p.fullName ?? t("addName")}</b>
          <span className="ui-meta">{account?.email ?? " "}</span>
          <span className="ui-meta">{[p.city, p.organisation].filter(Boolean).join(" · ") || t("poland")}</span>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>{t("edit")}</Button>
      </Card>

      <Section title={t("yourCase")}>
        <Card flush>
          <Row icon="case" title={permitLabel(p.permitType)} sub={stageLabel(p.stage)} href="/app/case" chevron />
          <Row icon="globe" title={t("chatLanguage")} sub={t("chatLanguageSub")} end={<span>{LANG[p.preferredLanguage] ?? p.preferredLanguage}</span>} onClick={() => setEditing(true)} />
          <Row icon="clock" title={t("timeZone")} end={<span>{t("warsaw")}</span>} />
        </Card>
      </Section>

      <Section title={tc("language")}>
        <Card className="st-lang">
          <p className="ui-meta">{tc("languageHint")}</p>
          <LanguagePicker />
        </Card>
      </Section>

      <PhoneSection key={p.phone.number ?? "none"} profile={p} eligible={account?.callsEligible ?? false} loaded={account !== null} />
      <ConnectionsSection />
      <AssistantSection />

      <Section title={t("app")}>
        <Card flush>
          <Row icon="card" title={t("plan")} href="/plan" chevron />
          <Row icon="bell" title={t("notifications")} href="/app/notifications" chevron />
        </Card>
      </Section>

      <Section title={t("privacy")}>
        <Card flush>
          <Row icon="shield" title={t("neverTitle")} sub={t("neverSub")} />
          <Row icon="lock" title={t("whereTitle")} sub={t("whereSub")} />
          <Row icon="book" title={t("privacyPolicy")} href="/legal/privacy" chevron />
          <Row icon="file" title={t("terms")} href="/legal/terms" chevron />
        </Card>
      </Section>

      {account?.previewFlow && <PreviewTools flow={account.previewFlow} />}
      <Button variant="danger" block onClick={() => void signOut()} loading={signingOut} icon="out">{t("signOut")}</Button>
      <p className="ui-meta st-foot">{t("foot")}</p>
      <ProfileSheet key={editing ? "open" : "closed"} open={editing} onClose={() => setEditing(false)} profile={p} />
    </div>
  );
}
