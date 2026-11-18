import { withCase } from "@/lib/case/route";
import { CaseClientError } from "@/lib/case/client";
import { warsawToday } from "@/lib/case/next-step";
import { planResidenceAction, ResidenceActionError, residenceActionSchema } from "@/lib/residence/actions";

export const dynamic = "force-dynamic";

/**
 * Residence-case actions: stage moves, household, checklist ticks, filing, decision, card collection.
 * Body: one of residenceActionSchema. Returns the updated case snapshot.
 */
export const POST = (req: Request) =>
  withCase(req, async (c, { body }) => {
    const action = residenceActionSchema.parse(await body());
    const snap = await c.snapshot();
    let plan;
    try {
      plan = planResidenceAction(snap, action, warsawToday());
    } catch (e) {
      if (e instanceof ResidenceActionError) throw new CaseClientError(400, e.message, e.code);
      throw e;
    }
    if (plan.facts) await c.patchFacts(plan.facts);
    if (plan.profile) await c.patchProfile(plan.profile);
    if (plan.deadline) {
      const { id, ...rest } = plan.deadline;
      if (snap.deadlines.some((d) => d.id === id)) await c.patch("deadlines", id, rest);
      else await c.create("deadlines", plan.deadline);
    }
    if (plan.removeDeadline && snap.deadlines.some((d) => d.id === plan.removeDeadline)) await c.remove("deadlines", plan.removeDeadline);
    return c.snapshot();
  });
