"use client";
import Link from "next/link";
import type { CaseSnapshot } from "@/lib/case/types";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { dayLabel, timeLabel } from "../format";
import { isFresh, latestReady } from "./derive";

/** Home entry to /app/ready while the agent's latest preparation is fresh. */
export function ReadyCard({ c, now }: { c: CaseSnapshot; now: Date }) {
  const t = useT("ready");
  const b = latestReady(c, now);
  if (!b || !isFresh(b, now)) return null;
  const parts = [
    b.drafts.length ? (b.drafts.length === 1 ? t("draftsOne") : t("draftsMany", { n: b.drafts.length })) : null,
    b.reminder ? t("reminderAt", { time: timeLabel(b.reminder.at) }) : null,
    b.deadline ? t("dueLower", { date: dayLabel(b.deadline.dueDate) }) : null,
  ].filter(Boolean);
  return (
    <Link href="/app/ready" className="hm-ready">
      <span className="hm-ready-orb" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
      <span className="hm-ready-main">
        <b>{t("title")}</b>
        <span>{parts.join(" · ")}</span>
      </span>
      <Icon name="forward" size={18} />
    </Link>
  );
}
