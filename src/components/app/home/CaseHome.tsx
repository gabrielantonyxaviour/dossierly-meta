"use client";
import { Avatar, ErrorState, IconLink, Pill, Skeleton, TopBar, useNow } from "@/components/ui";
import Link from "next/link";
import { useUnread } from "../AppShell";
import { firstName, greeting } from "../format";
import { useCaseData } from "../shell/case-data";
import { NextStepCard } from "./NextStepCard";
import { OpenTasks, QuickActions, RecentActivity, UpcomingAppointment } from "./HomeSections";
import { CaseStrip } from "./CaseStrip";
import { SAMPLE_LABEL_ID } from "@/lib/dev/sample-label";
import "./home.css";

function HomeSkeleton() {
  return (
    <div className="sh-page" aria-busy="true" aria-label="Loading your case">
      <div style={{ height: 56 }} />
      <Skeleton h={44} w="70%" />
      <Skeleton h={250} r={22} />
      <Skeleton h={96} r={22} />
      <Skeleton h={180} r={22} />
    </div>
  );
}

export function CaseHome() {
  const { status, snapshot, next, error, refresh } = useCaseData();
  const unread = useUnread();
  const now = useNow();
  if (status === "loading") return <HomeSkeleton />;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? "Your case didn’t load."} onRetry={() => void refresh()} /></div>;
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Warsaw" }).format(now);
  return (
    <div className="sh-page sh-page--wide hm">
      <TopBar
        title={`${greeting(now)}, ${firstName(snapshot.profile.fullName)}`}
        eyebrow={snapshot.events.some((e) => e.id === SAMPLE_LABEL_ID) ? <>{today} · <Pill tone="official">Sample case</Pill></> : today}
        actions={<>
          <IconLink href="/app/notifications" icon="bell" label={unread ? `Notifications, ${unread} unread` : "Notifications"} dot={unread > 0} />
          <Link href="/app/settings" className="hm-me" aria-label="Settings and profile"><Avatar name={snapshot.profile.fullName} size={34} /></Link>
        </>}
      />
      <div className="hm-grid">
        <div className="hm-col">
          <NextStepCard next={next} snapshot={snapshot} />
          <QuickActions />
          <UpcomingAppointment c={snapshot} />
        </div>
        <div className="hm-col">
          <OpenTasks c={snapshot} />
          <RecentActivity c={snapshot} />
          <CaseStrip c={snapshot} />
        </div>
      </div>
    </div>
  );
}
