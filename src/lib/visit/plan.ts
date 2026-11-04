import { CaseClientError, type CaseClient } from "@/lib/case/client";
import type { Appointment } from "@/lib/case/types";
import { costUsd, metaJson, webSearch } from "@/lib/model";
import { compareItems, isOfficial, numberCitations, officeOf } from "./compare";
import { buildQuery, caseSummary, purposeOf, SEARCH_SYSTEM, STRUCTURE_SYSTEM } from "./query";
import { saveMissingAsTasks } from "./save";
import { STRUCTURED_JSON_SCHEMA, structuredSchema, type VisitEvent, type VisitPlan, type VisitRequest } from "./types";

export interface PlanDeps {
  search?: typeof webSearch;
  structure?: typeof metaJson;
  now?: Date;
  emit?: (e: VisitEvent) => void;
}

export function pickAppointment(appts: Appointment[], id: string | undefined, now: Date): Appointment | null {
  if (id) {
    const found = appts.find((a) => a.id === id);
    if (!found) throw new CaseClientError(404, "Appointment not found", "appointment_not_found");
    return found;
  }
  const upcoming = appts.filter((a) => Date.parse(a.at) >= now.getTime()).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return upcoming[0] ?? null;
}

/** Builds a grounded checklist for the next appointment. Returns the plan and the model spend in USD. */
export async function buildVisitPlan(client: CaseClient, req: VisitRequest, deps: PlanDeps = {}): Promise<{ plan: VisitPlan; usd: number }> {
  const t0 = Date.now();
  const emit = deps.emit ?? (() => undefined);
  const now = deps.now ?? new Date();
  const snap = await client.snapshot();
  const appt = pickAppointment(snap.appointments, req.appointmentId, now);
  if (!appt && !req.purpose) throw new CaseClientError(400, "No upcoming appointment. Say what the visit is for.", "no_appointment");
  const purpose = purposeOf(appt, req.purpose);

  emit({ type: "stage", stage: "searching" });
  const found = await (deps.search ?? webSearch)({ query: buildQuery(snap, appt, purpose), system: SEARCH_SYSTEM, maxTokens: 3000 }, { timeoutMs: 75_000 });
  const cites = numberCitations(found.citations);

  emit({ type: "stage", stage: "comparing" });
  const numbered = cites.map((c, i) => `[${i + 1}] ${c.title} - ${c.url}`).join("\n") || "(no sources returned)";
  const out = await (deps.structure ?? metaJson)(
    {
      role: "agent", system: STRUCTURE_SYSTEM, schema: STRUCTURED_JSON_SCHEMA, maxTokens: 3500,
      user: `Visit: ${purpose}\nUser case: ${caseSummary(snap)}\n\nSources:\n${numbered}\n\nResearch text:\n${found.text.slice(0, 9000)}`,
    },
    { timeoutMs: 60_000 },
  );
  const structured = structuredSchema.parse(out.data);
  const items = compareItems(structured, snap.documents, cites);
  const warnings = [...structured.warnings];
  if (!cites.some((c) => isOfficial(c.url))) warnings.unshift("No official government page was found for this visit, so treat this list as a starting point and confirm it with the office.");
  if (!items.length) warnings.push("The research did not return a clear checklist. Check the office website before you go.");

  const plan: VisitPlan = {
    appointment: appt ? { id: appt.id, title: appt.title, at: appt.at, location: [appt.location.name, appt.location.address].filter(Boolean).join(", ") } : null,
    purpose, items, office: officeOf(structured, cites), warnings,
    citations: cites.map((c) => ({ ...c, official: isOfficial(c.url) })),
    searches: found.searches, ms: 0,
  };
  if (req.save && appt) plan.savedTaskIds = await saveMissingAsTasks(client, appt, items);
  plan.ms = Date.now() - t0;
  const usd = costUsd(found.model, found.usage) + costUsd(out.model, out.usage);
  return { plan, usd };
}
