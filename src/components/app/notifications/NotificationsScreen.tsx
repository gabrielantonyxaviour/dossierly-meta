"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, EmptyState, ErrorState, Skeleton, TopBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ago } from "../format";
import { useCaseData } from "../shell/case-data";
import { deriveNotices, markRead, readIds } from "./derive";
import "./notifications.css";

const TONE_BG: Record<string, [string, string]> = {
  deadline: ["var(--deadline-soft)", "var(--deadline)"], official: ["var(--official-soft)", "var(--official)"],
  agent: ["var(--agent-soft)", "var(--agent-a)"], ok: ["var(--ok-soft)", "var(--ok)"], neutral: ["var(--sunken)", "var(--ink-2)"],
};

export function NotificationsScreen() {
  const { snapshot, status, error, refresh } = useCaseData();
  const [read, setRead] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : readIds()));
  const items = useMemo(() => (snapshot ? deriveNotices(snapshot) : []), [snapshot]);
  const unread = items.filter((n) => !read.has(n.id));
  const markAll = () => { markRead(items.map((n) => n.id)); setRead(readIds()); };
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="50%" /><Skeleton h={300} r={22} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? "Notifications didn’t load."} onRetry={() => void refresh()} /></div>;
  return (
    <div className="sh-page">
      <TopBar title="Notifications" back={{ href: "/app", label: "Back to home" }}
        sub={unread.length ? `${unread.length} new` : "You’re up to date"}
        actions={unread.length > 0 ? <Button size="sm" variant="ghost" onClick={markAll}>Mark all read</Button> : undefined} />
      {items.length === 0 ? (
        <EmptyState icon="bell" title="No notifications">Deadlines, new letters and calls about your case show up here.</EmptyState>
      ) : (
        <ul className="nt-list">
          {items.map((n) => {
            const [bg, fg] = TONE_BG[n.tone];
            const isNew = !read.has(n.id);
            return (
              <li key={n.id}>
                <Link href={n.href} className={`nt-item${isNew ? " is-new" : ""}`} onClick={() => markRead([n.id])}>
                  <span className="nt-icon" style={{ background: bg, color: fg }}><Icon name={n.icon} size={18} /></span>
                  <span className="nt-main">
                    <span className="nt-title">{n.title}</span>
                    <span className="nt-body">{n.body}</span>
                    <span className="nt-time">{ago(n.at)}</span>
                  </span>
                  {isNew && <span className="nt-dot" aria-label="New" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
