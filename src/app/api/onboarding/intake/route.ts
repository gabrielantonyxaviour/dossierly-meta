import { runIntake, intakeSchema } from "@/lib/onboarding/intake";
import { withOnboarding } from "@/lib/onboarding/route";
import { ApiError, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/ratelimit";

export const dynamic = "force-dynamic";

/** Voice-first setup: one spoken introduction in, the saved profile and Dossierly's spoken reply out. */
export const POST = (req: Request) => withOnboarding(req, async ({ env, userId, accountId }) => {
  if (!(await rateLimit(env, accountId, "intake", 12, 600)).ok) throw new ApiError(429, "Too many tries. Wait a minute, or type instead.", "rate_limited");
  const { transcript } = await readJson(req, intakeSchema);
  return runIntake(env, userId, transcript);
});
