"use client";
import type { ReactNode } from "react";
import type { Finding } from "@/lib/onboarding/findings";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";

const dayLabel = (tag: string, iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat(tag, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
export const daysLeft = (iso: string) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${warsawToday()}T00:00:00Z`)) / 86_400_000);
const relDay = (t: T, tag: string, iso: string) => { const d = daysLeft(iso); return d === 0 ? t("today") : d === 1 ? t("tomorrow") : dayLabel(tag, iso); };
const street = (s: string) => s.replace(/^ul\.\s*/i, "").replace(/,\s*\d{2}-\d{3}.*$/, "");

type Doc = Extract<Finding, { kind: "document" }>;
export function docLabel(f: Doc, t: T): string {
  const title = f.title;
  switch (f.docKind) {
    case "rental_agreement": return t("docLease");
    case "health_insurance": return /nfz/i.test(`${title} ${f.source.from}`) ? t("docNfz") : t("docInsurance");
    case "photo": return /new|nowe|meeting/i.test(title) ? t("docNewPhoto") : t("docPhoto");
    case "upo": return t("docUpo");
    case "university_certificate": return t("docEnrolment");
    case "passport": return t("docPassport");
    default: return title;
  }
}
const who = (from: string) => from.replace(/<[^>]+>/, "").replace(/"/g, "").replace(/\s*\((PRZYKŁAD|SAMPLE)\)/gi, "").trim();

/** Label, one value line and a status tag: the facts that matter stay large enough to read at a glance. */
export function rowFor(f: Finding, t: T, tag: string): { label: string; value: ReactNode; tag?: { text: string; tone: "ok" | "warn" | "deadline" } } {
  if (f.kind === "fact") return { label: f.label, value: f.key === "filedAt" && /^\d{4}-\d{2}-\d{2}$/.test(f.value) ? dayLabel(tag, f.value, { day: "numeric", month: "short", year: "numeric" }) : <span className="ob-mono">{f.value}</span> };
  if (f.kind === "deadline") {
    const days = f.days ?? /(\d+) days/.exec(f.rule)?.[1];
    const left = daysLeft(f.dueDate);
    const by = dayLabel(tag, f.dueDate);
    return { label: f.title, value: days ? t("withinDaysBy", { days, date: by }) : t("byDate", { date: by }), tag: { text: left < 0 ? t("overdue") : left === 0 ? t("todayTag") : left === 1 ? t("dayLeft") : t("daysLeft", { n: left }), tone: "deadline" } };
  }
  if (f.kind === "appointment") return { label: `${f.title} · ${relDay(t, tag, f.date)}${f.time ? ` ${f.time}` : ""}`, value: street(f.address || f.place) || f.place };
  if (f.kind === "document") {
    const doc = docLabel(f, t);
    if (f.status !== "have") return { label: doc, value: t("docMissingValue"), tag: { text: t("missing"), tone: "warn" } };
    const where = f.fields?.address ? `${street(f.fields.address)}${f.fields.startDate ? ` · ${t("fromDate", { date: dayLabel(tag, f.fields.startDate, { day: "numeric", month: "short" }) })}` : ""}`
      : f.fields?.applicationAddress ? t("applicationAddress", { address: street(f.fields.applicationAddress) }) : t("fromSender", { sender: who(f.source.from) || t("yourEmail") });
    const label = f.file?.mime === "application/pdf" ? t("docPdf", { doc }) : f.file ? t("docPhotoFile", { doc }) : doc;
    return { label, value: where, tag: { text: t("inYourCase"), tone: "ok" } };
  }
  return { label: f.title, value: f.detail };
}

export function HowCounted({ f }: { f: Finding }) {
  const t = useT("onboarding");
  if (f.kind !== "deadline") return null;
  return (
    <details className="ob-how" onClick={(e) => e.stopPropagation()}>
      <summary>{t("howCounted")}</summary>
      {f.quote && <blockquote lang="pl">{f.quote}</blockquote>}
      <ol>{f.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      {f.consequence && <p className="ob-find-warn">{t("ifMissed", { consequence: f.consequence })}</p>}
    </details>
  );
}
