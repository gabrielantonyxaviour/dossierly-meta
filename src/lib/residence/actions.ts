import { z } from "zod";
import { PERMIT_TYPES, RESIDENCE_STAGES, type CaseSnapshot, type HouseholdMember } from "@/lib/case/types";
import { CHECK_ID } from "./checklist";
import { appealDeadline } from "./dates";
import { under16From } from "./model";
import { stagePatch } from "./stage";

/*
 * Residence-case writes (POST /api/case/residence). Each action is validated here and turned into plain case
 * patches; the route applies them through the case Durable Object. Pure, so the rules are unit-tested.
 */

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s) && s >= "2000-01-01" && s <= "2100-12-31";
}, "Invalid date");

const memberInput = z.object({
  id: z.string().regex(/^m[a-z0-9]{4,20}$/).optional(),
  name: z.string().trim().min(1).max(120),
  relation: z.enum(["spouse", "child"]),
  birthYear: z.number().int().min(1920).max(2100).nullable(),
  permitType: z.enum(PERMIT_TYPES).optional(),
}).strict();

export const residenceActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stage"), stage: z.enum(RESIDENCE_STAGES) }).strict(),
  z.object({ action: z.literal("household"), members: z.array(memberInput).max(3) }).strict(),
  z.object({ action: z.literal("tick"), item: z.string().regex(CHECK_ID), done: z.boolean() }).strict(),
  z.object({ action: z.literal("filed"), filedOn: ymd, caseNumber: z.string().trim().min(3).max(80).nullable() }).strict(),
  z.object({ action: z.literal("decision"), outcome: z.enum(["approved", "refused"]), deliveredOn: ymd, validUntil: ymd.nullable() }).strict(),
  z.object({ action: z.literal("card"), collectedOn: ymd }).strict(),
  z.object({ action: z.literal("clear_decision") }).strict(),
]);
export type ResidenceAction = z.infer<typeof residenceActionSchema>;

export const APPEAL_DEADLINE_ID = "ddl_appeal";

export type ResidencePlan = {
  profile?: Record<string, unknown>;
  facts?: Record<string, unknown>;
  /** Created or replaced (same id). */
  deadline?: { id: string; title: string; dueDate: string; computation: { steps: string[]; rule: string | null; legalRefUrl: string | null }; triggeredBy: null; status: "open" };
  /** Deletes this deadline if it exists (a corrected decision). */
  removeDeadline?: string;
};

const memberId = () => `m${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

export class ResidenceActionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export function planResidenceAction(c: CaseSnapshot, a: ResidenceAction, today: string): ResidencePlan {
  const p = c.profile;
  switch (a.action) {
    case "stage":
      return { profile: stagePatch(a.stage) };
    case "household": {
      const onDate = p.legalStayUntil ?? today;
      const members: HouseholdMember[] = a.members.map((m) => ({
        id: m.id ?? memberId(),
        name: m.name,
        relation: m.relation,
        birthYear: m.birthYear,
        under16: m.relation === "child" && under16From(m.birthYear, onDate),
        permitType: m.permitType ?? "temporary_residence_family",
      }));
      const keep = new Set(members.map((m) => m.id));
      // Fee ticks of removed members go with them.
      const checklistDone = (p.checklistDone ?? []).filter((id) => !/^fee_(stamp|card)_m/.test(id) || keep.has(id.replace(/^fee_(stamp|card)_/, "")));
      return { profile: { household: members, checklistDone } };
    }
    case "tick": {
      const cur = new Set(p.checklistDone ?? []);
      if (a.done) cur.add(a.item);
      else cur.delete(a.item);
      return { profile: { checklistDone: [...cur].slice(0, 80) } };
    }
    case "filed": {
      if (a.filedOn > today) throw new ResidenceActionError("The filing date cannot be in the future.", "future_date");
      const source = { type: "user", ref: null };
      const facts: Record<string, unknown> = { filedAt: { value: a.filedOn, source, confirmedByUser: true } };
      if (a.caseNumber) facts.caseNumber = { value: a.caseNumber, source, confirmedByUser: true };
      return { profile: stagePatch("waiting"), facts };
    }
    case "decision": {
      if (a.deliveredOn > today) throw new ResidenceActionError("The delivery date cannot be in the future.", "future_date");
      // Correcting the dates of the same outcome keeps a recorded card collection.
      const cardCollectedOn = a.outcome === "approved" && p.decision?.outcome === "approved" ? p.decision.cardCollectedOn : null;
      const decision = { outcome: a.outcome, deliveredOn: a.deliveredOn, validUntil: a.outcome === "approved" ? a.validUntil : null, cardCollectedOn };
      const plan: ResidencePlan = { profile: { decision, ...stagePatch(cardCollectedOn ? "after" : "decision") } };
      if (a.outcome === "refused") {
        const d = appealDeadline(a.deliveredOn);
        plan.deadline = {
          id: APPEAL_DEADLINE_ID,
          title: "Appeal against the refusal",
          dueDate: d.dueDate,
          computation: { steps: d.steps.slice(0, 20), rule: d.rule, legalRefUrl: d.citations[0]?.url ?? null },
          triggeredBy: null,
          status: "open",
        };
      } else plan.removeDeadline = APPEAL_DEADLINE_ID;
      return plan;
    }
    case "card": {
      if (!p.decision || p.decision.outcome !== "approved") throw new ResidenceActionError("Record the approval first.", "no_approval");
      if (a.collectedOn > today) throw new ResidenceActionError("The collection date cannot be in the future.", "future_date");
      return { profile: { decision: { ...p.decision, cardCollectedOn: a.collectedOn }, ...stagePatch("after") } };
    }
    case "clear_decision":
      return { profile: { decision: null, ...stagePatch("waiting") }, removeDeadline: APPEAL_DEADLINE_ID };
  }
}
