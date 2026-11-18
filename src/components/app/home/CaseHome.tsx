"use client";
import { Avatar, ErrorState, IconLink, Skeleton, TopBar, useNow } from "@/components/ui";
import Link from "next/link";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { useUnread } from "../AppShell";
import { firstName, greeting } from "../format";
import { useCaseData } from "../shell/case-data";
import { CasePathCard, ResidenceHero } from "../residence/ResidenceHome";
import { OpenTasks, QuickActions, RecentActivity, UpcomingAppointment } from "./HomeSections";
import { CaseStrip } from "./CaseStrip";
import { ReadyCard } from "../ready/ReadyCard";
import { ReviewEntry } from "../review/ReviewEntry";
import "./home.css";

function HomeSkeleton() {
  const t = useT("home");
  return (
    <div className="sh-page" aria-busy="true" aria-label={t("loadingCase")}>
      <div style={{ height: 56 }} />
      <Skeleton h={44} w="70%" />
      <Skeleton h={250} r={22} />
      <Skeleton h={96} r={22} />
      <Skeleton h={180} r={22} />
    </div>
  );
}

export function CaseHome() {
  const t = useT("home");
  const tag = LOCALE_TAGS[useLocale()];
  const { status, snapshot, next, error, refresh } = useCaseData();
  const unread = useUnread();
  const now = useNow();
  if (status === "loading") return <HomeSkeleton />;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? t("loadFailed")} onRetry={() => void refresh()} /></div>;
  const today = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" }).format(now);
  return (
    <div className="sh-page sh-page--wide hm">
      <TopBar
        title={t("greetingTitle", { greeting: greeting(now), name: firstName(snapshot.profile.fullName) })}
        eyebrow={today}
        actions={<>
          <IconLink href="/app/notifications" icon="bell" label={unread ? t("notificationsUnread", { n: unread }) : t("notifications")} dot={unread > 0} />
          <Link href="/app/settings" className="hm-me" aria-label={t("settingsProfile")}><Avatar name={snapshot.profile.fullName} size={34} /></Link>
        </>}
      />
      <div className="hm-grid">
        <div className="hm-col">
          <ReadyCard c={snapshot} now={now} />
          <ResidenceHero c={snapshot} next={next} />
          <QuickActions />
          <ReviewEntry c={snapshot} />
          <UpcomingAppointment c={snapshot} />
        </div>
        <div className="hm-col">
          <CasePathCard c={snapshot} />
          <OpenTasks c={snapshot} />
          <RecentActivity c={snapshot} />
          <CaseStrip c={snapshot} />
        </div>
      </div>
    </div>
  );
}
