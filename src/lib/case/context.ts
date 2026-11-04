import { nextStep, warsawDate, warsawTime, warsawToday } from "./next-step";
import { FACT_KEYS, type CaseSnapshot } from "./types";

/** "Wednesday 18 November 2026 (2026-11-18)": spelled out so the model never has to work out a weekday itself. */
export function dayLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const d = new Date(`${ymd}T12:00:00Z`);
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
  return `${name.replace(",", "")} (${ymd})`;
}

/** Spells out ISO dates (YYYY-MM-DD) inside free text, e.g. computation steps or extracted fields. */
const withDays = (s: string) => s.replace(/\b(\d{4}-\d{2}-\d{2})\b(?! \()/g, (m) => dayLabel(m));

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Compact plain-text rendering of the whole case for model prompts. Never includes file keys or phone numbers. */
export function caseContext(c: CaseSnapshot, now: Date = new Date(), opts: { maxEvents?: number } = {}): string {
  const p = c.profile;
  const today = warsawToday(now);
  const out: string[] = [`CASE (today is ${dayLabel(today)}, Europe/Warsaw). Use the weekday names exactly as written here; never compute a weekday yourself.`];
  out.push(
    `Profile: ${p.fullName ?? "name unknown"}; language ${p.preferredLanguage}; ${p.city ?? "city unknown"}, PL; permit ${p.permitType ?? "unknown"}; stage ${p.stage}` +
      `${p.organisation ? `; ${p.organisation}` : ""}${p.arrivalDate ? `; arrived ${p.arrivalDate}` : ""}; calls ${p.phone.callsEnabled && p.phone.verified ? "on" : "off"}`,
  );
  const facts = FACT_KEYS.flatMap((k) => {
    const f = c.facts[k];
    return f ? [`${k}=${withDays(f.value)} [${f.source.type}${f.confirmedByUser ? ", confirmed" : ", unconfirmed"}]`] : [];
  });
  out.push(`Facts: ${facts.join("; ") || "none yet"}`);
  const section = (title: string, lines: string[]) => out.push(lines.length ? `${title}:\n${lines.map((l) => `- ${l}`).join("\n")}` : `${title}: none`);
  section("Documents", c.documents.map((d) => `${d.title} (${d.kind}) ${d.status}${d.pages ? `, ${d.pages}p` : ""}${Object.keys(d.extractedFields).length ? ` {${Object.entries(d.extractedFields).map(([k, v]) => `${k}: ${clip(withDays(v), 80)}`).join(", ")}}` : ""} #${d.id}`));
  section("Deadlines", c.deadlines.map((d) => `${dayLabel(d.dueDate)} ${d.title} [${d.status}]${d.computation.rule ? ` (${d.computation.rule})` : ""}${d.computation.steps.length ? ` how: ${clip(withDays(d.computation.steps.join(" > ")), 320)}` : ""} #${d.id}`));
  section("Tasks", c.tasks.filter((t) => t.status === "open").map((t) => `${t.title}${t.detail ? `: ${clip(t.detail)}` : ""}${t.dueDeadlineId ? ` (for #${t.dueDeadlineId})` : ""} #${t.id}`));
  section("Appointments", c.appointments.map((a) => `${dayLabel(warsawDate(a.at))} ${warsawTime(a.at)} Warsaw time ${a.title} at ${a.location.name}${a.location.address ? `, ${a.location.address}` : ""}${a.purpose ? ` - ${clip(a.purpose, 100)}` : ""} #${a.id}`));
  section("Recent events", c.events.slice(0, opts.maxEvents ?? 10).map((e) => `${dayLabel(e.at.slice(0, 10))} ${e.type}: ${clip(e.summary)}`));
  const n = nextStep(c, now);
  out.push(`Next step: ${n ? `${n.title}${n.date ? ` (${dayLabel(n.date)}${n.overdue ? ", OVERDUE" : `, ${n.daysLeft}d`})` : ""}` : "none"}`);
  return out.join("\n");
}
