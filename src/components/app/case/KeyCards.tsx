"use client";
import Link from "next/link";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { Icon } from "@/components/Icon";
import { timeLabel } from "../format";

const dayShort = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** "Reply to summons: submit missing…" → "Reply to summons"; "Fingerprints (odciski palców)" → "Fingerprints". */
export const shortTitle = (t: string) => t.split(/\s*[:(–—]\s*/)[0].trim() || t;
/** "ul. Marszałkowska 3/5, 00-624 Warszawa" → "Marszałkowska 3/5". */
export const shortAddress = (a: string) => a.split(",")[0].replace(/^(ul\.|al\.|pl\.)\s*/i, "").trim();
/** "KPA art. 64 § 2" → "KPA 64 §2". */
export const shortRule = (r: string) => r.replace(/\bart\.\s*/i, "").replace(/§\s+/g, "§").trim();

function whenLabel(days: number, date: string) {
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : dayShort(date);
}

/**
 * The case's two or three facts that matter right now, large enough to read in a phone panel at 45% scale:
 * the next appointment and the nearest open deadlines.
 */
export function KeyCards({ c, now = new Date() }: { c: CaseSnapshot; now?: Date }) {
  const today = warsawToday(now);
  const appt = [...c.appointments]
    .filter((a) => new Date(a.at).getTime() > now.getTime() - 3 * 3600_000 && daysBetween(today, warsawDate(a.at)) <= 30)
    .sort((a, b) => a.at.localeCompare(b.at))[0];
  const deadlines = c.deadlines.filter((d) => d.status === "open").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, appt ? 2 : 3);
  if (!appt && !deadlines.length) return null;
  return (
    <section className="kc" aria-label="Coming up in your case">
      {appt && (() => {
        const days = daysBetween(today, warsawDate(appt.at));
        return (
          <Link href="/app/case?tab=dates" className="kc-card kc-card--appt">
            <span className="kc-label"><Icon name="calendar" size={18} />{shortTitle(appt.title)}</span>
            <span className="kc-big">{whenLabel(days, warsawDate(appt.at))} {timeLabel(appt.at)}</span>
            <span className="kc-sub">{shortAddress(appt.location.address || appt.location.name)}</span>
          </Link>
        );
      })()}
      {deadlines.map((d) => {
        const left = daysBetween(today, d.dueDate);
        return (
          <Link key={d.id} href={`/app/case/deadlines/${d.id}`} className={`kc-card kc-card--deadline${left <= 7 ? " is-urgent" : ""}`}>
            <span className="kc-label"><Icon name="clock" size={18} />{shortTitle(d.title)}</span>
            <span className="kc-big">by {dayShort(d.dueDate)}</span>
            <span className="kc-sub">
              {d.computation.rule && <b>{shortRule(d.computation.rule)}</b>}
              {left < 0 ? `${-left} days overdue` : left === 0 ? "due today" : `${left} day${left === 1 ? "" : "s"} left`}
            </span>
          </Link>
        );
      })}
    </section>
  );
}
