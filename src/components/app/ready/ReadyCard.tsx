"use client";
import Link from "next/link";
import type { CaseSnapshot } from "@/lib/case/types";
import { Icon } from "@/components/Icon";
import { timeLabel } from "../format";
import { isFresh, latestReady } from "./derive";

const dayShort = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** Home entry to /app/ready while the agent's latest preparation is fresh. */
export function ReadyCard({ c, now }: { c: CaseSnapshot; now: Date }) {
  const b = latestReady(c, now);
  if (!b || !isFresh(b, now)) return null;
  const parts = [
    b.drafts.length ? `${b.drafts.length} draft${b.drafts.length === 1 ? "" : "s"}` : null,
    b.reminder ? `reminder ${timeLabel(b.reminder.at)}` : null,
    b.deadline ? `due ${dayShort(b.deadline.dueDate)}` : null,
  ].filter(Boolean);
  return (
    <Link href="/app/ready" className="hm-ready">
      <span className="hm-ready-orb" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
      <span className="hm-ready-main">
        <b>Ready for you</b>
        <span>{parts.join(" · ")}</span>
      </span>
      <Icon name="forward" size={18} />
    </Link>
  );
}
