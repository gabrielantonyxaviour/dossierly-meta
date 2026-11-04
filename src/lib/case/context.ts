import { nextStep, warsawDate, warsawTime, warsawToday } from "./next-step";
import { FACT_KEYS, type CaseSnapshot } from "./types";

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Compact plain-text rendering of the whole case for model prompts. Never includes file keys or phone numbers. */
export function caseContext(c: CaseSnapshot, now: Date = new Date(), opts: { maxEvents?: number } = {}): string {
  const p = c.profile;
  const today = warsawToday(now);
  const out: string[] = [`CASE (today ${today}, Europe/Warsaw)`];
  out.push(
    `Profile: ${p.fullName ?? "name unknown"}; language ${p.preferredLanguage}; ${p.city ?? "city unknown"}, PL; permit ${p.permitType ?? "unknown"}; stage ${p.stage}` +
      `${p.organisation ? `; ${p.organisation}` : ""}${p.arrivalDate ? `; arrived ${p.arrivalDate}` : ""}; calls ${p.phone.callsEnabled && p.phone.verified ? "on" : "off"}`,
  );
  const facts = FACT_KEYS.flatMap((k) => {
    const f = c.facts[k];
    return f ? [`${k}=${f.value} [${f.source.type}${f.confirmedByUser ? ", confirmed" : ", unconfirmed"}]`] : [];
  });
  out.push(`Facts: ${facts.join("; ") || "none yet"}`);
  const section = (title: string, lines: string[]) => out.push(lines.length ? `${title}:\n${lines.map((l) => `- ${l}`).join("\n")}` : `${title}: none`);
  section("Documents", c.documents.map((d) => `${d.title} (${d.kind}) ${d.status}${d.pages ? `, ${d.pages}p` : ""}${Object.keys(d.extractedFields).length ? ` {${Object.entries(d.extractedFields).map(([k, v]) => `${k}: ${clip(v, 60)}`).join(", ")}}` : ""} #${d.id}`));
  section("Deadlines", c.deadlines.map((d) => `${d.dueDate} ${d.title} [${d.status}]${d.computation.rule ? ` (${d.computation.rule})` : ""}${d.computation.steps.length ? ` how: ${clip(d.computation.steps.join(" > "), 240)}` : ""} #${d.id}`));
  section("Tasks", c.tasks.filter((t) => t.status === "open").map((t) => `${t.title}${t.detail ? `: ${clip(t.detail)}` : ""}${t.dueDeadlineId ? ` (for #${t.dueDeadlineId})` : ""} #${t.id}`));
  section("Appointments", c.appointments.map((a) => `${warsawDate(a.at)} ${warsawTime(a.at)} Warsaw time ${a.title} at ${a.location.name}${a.location.address ? `, ${a.location.address}` : ""}${a.purpose ? ` - ${clip(a.purpose, 100)}` : ""} #${a.id}`));
  section("Recent events", c.events.slice(0, opts.maxEvents ?? 10).map((e) => `${e.at.slice(0, 10)} ${e.type}: ${clip(e.summary)}`));
  const n = nextStep(c, now);
  out.push(`Next step: ${n ? `${n.title}${n.date ? ` (${n.date}${n.overdue ? ", OVERDUE" : `, ${n.daysLeft}d`})` : ""}` : "none"}`);
  return out.join("\n");
}
