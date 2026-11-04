"use client";
import { Suspense } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { StaticAppShell } from "@/components/app/AppShell";
import { CaseHome } from "@/components/app/home/CaseHome";
import { CaseScreen } from "@/components/app/case/CaseScreen";
import { ReadyScreen } from "@/components/app/ready/ReadyScreen";
import { NotificationsScreen } from "@/components/app/notifications/NotificationsScreen";

export function FilmScreen({ screen, snapshot }: { screen: "home" | "case" | "ready" | "notifications"; snapshot: CaseSnapshot }) {
  return (
    <StaticAppShell snapshot={snapshot}>
      <Suspense>
        {screen === "home" && <CaseHome />}
        {screen === "case" && <CaseScreen />}
        {screen === "ready" && <ReadyScreen />}
        {screen === "notifications" && <NotificationsScreen />}
      </Suspense>
    </StaticAppShell>
  );
}
