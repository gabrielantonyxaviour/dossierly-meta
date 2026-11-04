"use client";
import type { ReactNode } from "react";
import type { Finding } from "@/lib/onboarding/findings";

const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
export const daysLeft = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${warsawToday()}T00:00:00Z`)) / 86_400_000);
const relDay = (iso: string) => { const d = daysLeft(iso); return d === 0 ? "today" : d === 1 ? "tomorrow" : dayLabel(iso); };
const street = (s: string) => s.replace(/^ul\.\s*/i, "").replace(/,\s*\d{2}-\d{3}.*$/, "");

type Doc = Extract<Finding, { kind: "document" }>;
export function docLabel(f: Doc): string {
  const t = f.title;
  switch (f.docKind) {
    case "rental_agreement": return "Lease";
    case "health_insurance": return /nfz/i.test(t) ? "NFZ insurance" : "Health insurance";
    case "photo": return /new|nowe|meeting/i.test(t) ? "New photo" : "Photo";
    case "upo": return "MOS filing confirmation";
    case "university_certificate": return "Enrolment certificate";
    case "passport": return "Passport";
    default: return t;
  }
}
const who = (from: string) => from.replace(/<[^>]+>/, "").replace(/"/g, "").trim();

/** Label, one value line and a status tag: the facts that matter stay large enough to read at a glance. */
export function rowFor(f: Finding): { label: string; value: ReactNode; tag?: { text: string; tone: "ok" | "warn" | "deadline" } } {
  if (f.kind === "fact") return { label: f.label, value: f.key === "filedAt" && /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? dayLabel(f.value, { day: "numeric", month: "short", year: "numeric" }) : <span className="ob-mono">{f.value}</span> };
  if (f.kind === "deadline") {
    const days = /(\d+) days/.exec(f.rule)?.[1];
    const left = daysLeft(f.dueDate);
    return { label: f.title, value: `${days ? `Within ${days} days · ` : ""}by ${dayLabel(f.dueDate)}`, tag: { text: left < 0 ? "Overdue" : left === 0 ? "Today" : `${left} days left`, tone: "deadline" } };
  }
  if (f.kind === "appointment") return { label: `${f.title} · ${relDay(f.date)}${f.time ? ` ${f.time}` : ""}`, value: street(f.address || f.place) || f.place };
  if (f.kind === "document") {
    const pdf = f.file?.mime === "application/pdf" ? " (PDF)" : f.file ? " (photo)" : "";
    if (f.status !== "have") return { label: docLabel(f), value: "The office asked for it. It isn’t in your email.", tag: { text: "Missing", tone: "warn" } };
    const where = f.fields?.address ? `${street(f.fields.address)}${f.fields.startDate ? ` · from ${dayLabel(f.fields.startDate, { day: "numeric", month: "short" })}` : ""}`
      : f.fields?.applicationAddress ? `Application address: ${street(f.fields.applicationAddress)}` : `From ${who(f.source.from) || "your email"}`;
    return { label: `${docLabel(f)}${pdf}`, value: where, tag: { text: "In your case", tone: "ok" } };
  }
  return { label: f.title, value: f.detail };
}

export function HowCounted({ f }: { f: Finding }) {
  if (f.kind !== "deadline") return null;
  return (
    <details className="ob-how" onClick={(e) => e.stopPropagation()}>
      <summary>How I counted</summary>
      {f.quote && <blockquote lang="pl">{f.quote}</blockquote>}
      <ol>{f.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {f.consequence && <p className="ob-find-warn">If missed: {f.consequence}</p>}
    </details>
  );
}
