"use client";
import { Suspense } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { StaticAppShell } from "@/components/app/AppShell";
import { CaseHome } from "@/components/app/home/CaseHome";
import { CaseScreen } from "@/components/app/case/CaseScreen";
import { ReadyScreen } from "@/components/app/ready/ReadyScreen";
import { NotificationsScreen } from "@/components/app/notifications/NotificationsScreen";
import { SettingsScreen } from "@/components/app/settings/SettingsScreen";
import { ReviewScreen } from "@/components/app/review/ReviewScreen";

export function FilmScreen({ screen, snapshot }: { screen: "home" | "case" | "ready" | "notifications" | "settings" | "review"; snapshot: CaseSnapshot }) {
  return (
    <StaticAppShell snapshot={snapshot}>
      <Suspense>
        {screen === "home" && <CaseHome />}
        {screen === "case" && <CaseScreen />}
        {screen === "ready" && <ReadyScreen />}
        {screen === "notifications" && <NotificationsScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "review" && <ReviewScreen />}
      </Suspense>
    </StaticAppShell>
  );
}
