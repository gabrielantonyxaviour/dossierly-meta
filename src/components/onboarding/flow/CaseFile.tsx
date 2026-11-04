import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LanguageSchema } from "@/lib/schemas";
import { REASONS, STAGES, type Reason } from "./options";

const permitLabel = (p: Profile["permitType"], reason: Reason | null) =>
  p === "temporary_residence_study" ? "Temporary residence · studies" : p === "temporary_residence_work" ? "Temporary residence · work"
  : p ? (REASONS.find((r) => r.id === reason)?.hint ?? "Temporary residence · other grounds") : null;

/** The case taking shape as the person answers: amber marks what they told us, purple what came from official mail. */
export function CaseFile({ profile, reason, step, found }: { profile: Profile; reason: Reason | null; step: number; found: number }) {
  const lang = LanguageSchema.catch("en").parse(profile.preferredLanguage);
  const rows: [string, string | null][] = [
    ["Name", profile.fullName],
    ["Language", profile.fullName ? LANGUAGE_META[lang].label : null],
    ["Permit", permitLabel(profile.permitType, reason)],
    ["Stage", step > 3 ? STAGES.find((s) => s.id === profile.stage)?.title ?? null : null],
    ["City", profile.city ? `${profile.city}, Poland` : null],
    [profile.permitType === "temporary_residence_work" ? "Employer" : "University", profile.organisation],
    ["Arrived", profile.arrivalDate ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${profile.arrivalDate}T00:00:00Z`)) : null],
  ];
  const filled = rows.filter(([, v]) => v);
  return (
    <aside className="ob-file" aria-label="Your case so far">
      <div className="ob-file-head"><span>Case file</span><span>{filled.length ? "Building…" : "Empty"}</span></div>
      <dl>
        {rows.map(([k, v]) => <div key={k} data-filled={!!v}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}
        <div data-filled={found > 0} data-source="official"><dt>From your mail</dt><dd>{found ? `${found} confirmed ${found === 1 ? "item" : "items"}` : step >= 5 ? "Reading…" : "—"}</dd></div>
      </dl>
      <p className="ob-file-legend"><i data-source="user" />You told me <i data-source="official" />Official mail</p>
    </aside>
  );
}
