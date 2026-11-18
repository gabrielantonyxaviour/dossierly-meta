"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "../Icon";
import { Logo } from "../Logo";
import { AgentOrb, Avatar, ToastProvider } from "@/components/ui";
import { CaseDataProvider, StaticCaseData, useCaseData } from "./shell/case-data";
import type { CaseSnapshot } from "@/lib/case/types";
import { isLegacyRoute, LegacyBoundary } from "./shell/Legacy";
import { AGENT, IMMERSIVE, isActive, SIDE_MAIN, SIDE_MORE, TABS_LEFT, TABS_RIGHT, type NavItem } from "./shell/nav";
import { deriveNotices, readIds } from "./notifications/derive";
import { useT } from "@/lib/i18n/client";
import "@/components/ui/shell.css";

function useUnread(): number {
  const { snapshot } = useCaseData();
  const [read, setRead] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const sync = () => setRead(readIds());
    sync();
    window.addEventListener("dossierly:notices-read", sync);
    return () => window.removeEventListener("dossierly:notices-read", sync);
  }, []);
  return snapshot ? deriveNotices(snapshot).filter((n) => !read.has(n.id)).length : 0;
}

function TabLink({ item, path }: { item: NavItem; path: string }) {
  const t = useT("shell");
  const active = isActive(path, item);
  return (
    <Link href={item.href} className={`sh-tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon name={item.icon} size={23} />
      <span>{t(item.label)}</span>
    </Link>
  );
}

function SideLink({ item, path, badge }: { item: NavItem; path: string; badge?: number }) {
  const t = useT("shell");
  const active = isActive(path, item);
  return (
    <Link href={item.href} className={`sh-side-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
      <Icon name={item.icon} size={20} />
      <span>{t(item.label)}</span>
      {!!badge && <span className="sh-count" aria-label={t("unreadCount", { n: badge })}>{badge}</span>}
    </Link>
  );
}

function Sidebar({ path }: { path: string }) {
  const t = useT("shell");
  const { snapshot } = useCaseData();
  const unread = useUnread();
  const name = snapshot?.profile.fullName;
  return (
    <aside className="sh-side" aria-label={t("mainNav")}>
      <Link href="/app" className="sh-logo" aria-label={t("logoHome")}><Logo size={22} /></Link>
      <nav className="sh-side-nav">
        {SIDE_MAIN.map((n) => <SideLink key={n.href} item={n} path={path} />)}
        <hr />
        {SIDE_MORE.map((n) => <SideLink key={n.href} item={n} path={path} badge={n.href === "/app/notifications" ? unread : undefined} />)}
      </nav>
      <Link href="/app/call" className="sh-talk">
        <AgentOrb size={36} icon="phone" />
        <span><b>{t("talkTitle")}</b><small>{t("talkSub")}</small></span>
      </Link>
      <Link href="/app/settings" className="sh-me">
        <Avatar name={name} size={34} />
        <span><b>{name ?? t("yourProfile")}</b><small>{t("sideSub", { city: snapshot?.profile.city ?? t("poland") })}</small></span>
      </Link>
    </aside>
  );
}

function TabBar({ path }: { path: string }) {
  const t = useT("shell");
  const agentActive = isActive(path, AGENT);
  return (
    <nav className="sh-tabbar" aria-label={t("mainNav")}>
      {TABS_LEFT.map((n) => <TabLink key={n.href} item={n} path={path} />)}
      <Link href={AGENT.href} className={`sh-tab sh-tab--agent${agentActive ? " is-active" : ""}`} aria-label={t("navAsk")} aria-current={agentActive ? "page" : undefined}>
        <AgentOrb size={52} icon="sparkle" />
      </Link>
      {TABS_RIGHT.map((n) => <TabLink key={n.href} item={n} path={path} />)}
    </nav>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const immersive = IMMERSIVE.some((r) => path === r || path.startsWith(`${r}/`));
  return (
    <div className={`sh${immersive ? " sh--immersive" : ""}`}>
      <Sidebar path={path} />
      <main className="sh-main" id="main">
        {isLegacyRoute(path) ? <LegacyBoundary>{children}</LegacyBoundary> : children}
      </main>
      {!immersive && <TabBar path={path} />}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CaseDataProvider>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </CaseDataProvider>
  );
}

/** The real shell over a fixed snapshot (preview-only /kit layout checks). */
export function StaticAppShell({ snapshot, children }: { snapshot: CaseSnapshot; children: React.ReactNode }) {
  return (
    <StaticCaseData snapshot={snapshot}>
      <ToastProvider>
        <Shell>{children}</Shell>
      </ToastProvider>
    </StaticCaseData>
  );
}

export { useUnread };
