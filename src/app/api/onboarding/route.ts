import { z } from "zod";
import { caseClient } from "@/lib/case/client";
import { demoCallsAllowed, normalisePhone } from "@/lib/onboarding/phone";
import { checkEmailOrigin } from "@/lib/server/email-auth";
import { getEnv } from "@/lib/server/env";
import { onboardingError } from "@/lib/onboarding/http";
import { ApiError, readJson } from "@/lib/server/http";
import { completeOnboarding, getOnboarding, ONBOARDING_STEPS, restartOnboarding, setOnboardingStep } from "@/lib/server/onboarding";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
const noStore = { "cache-control": "no-store" };

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("step"), step: z.number().int().min(1).max(ONBOARDING_STEPS) }).strict(),
  z.object({ action: z.literal("phone"), number: z.string().trim().max(32) }).strict(),
  z.object({ action: z.literal("skip_phone") }).strict(),
  z.object({ action: z.literal("complete") }).strict(),
  z.object({ action: z.literal("restart") }).strict(),
]);

async function email(accountId: string): Promise<string | null> {
  const row = await getEnv().DB.prepare("SELECT email FROM email_identities WHERE user_id=? AND verified_at>0").bind(accountId).first<{ email: string }>();
  return row?.email ?? null;
}

export async function GET(req: Request) {
  try {
    const { userId, accountId } = await requireUser(req);
    const env = getEnv();
    const [onboarding, profile, signedInAs] = await Promise.all([getOnboarding(env, accountId), caseClient(userId).snapshot().then((c) => c.profile), email(accountId)]);
    return Response.json({ onboarding, profile, email: signedInAs }, { headers: noStore });
  } catch (e) {
    return onboardingError(e);
  }
}

export async function POST(req: Request) {
  try {
    const env = getEnv();
    checkEmailOrigin(req, env);
    const { userId, accountId } = await requireUser(req);
    const body = await readJson(req, bodySchema);
    const store = caseClient(userId);
    switch (body.action) {
      case "step":
        return Response.json({ onboarding: await setOnboardingStep(env, accountId, body.step) }, { headers: noStore });
      case "phone": {
        const number = normalisePhone(body.number);
        if (!number) throw new ApiError(400, "Enter the number with its country code, for example +48 512 345 678.", "invalid_phone");
        const calls = await demoCallsAllowed(env, accountId, number);
        const profile = await store.patchProfile({ phone: { number, verified: calls, callsEnabled: calls } });
        return Response.json({ profile, callsAvailable: calls }, { headers: noStore });
      }
      case "skip_phone": {
        const profile = await store.patchProfile({ phone: { number: null, verified: false, callsEnabled: false } });
        return Response.json({ profile, callsAvailable: false }, { headers: noStore });
      }
      case "complete": {
        const profile = (await store.snapshot()).profile;
        if (!profile.fullName || !profile.permitType) throw new ApiError(400, "Tell us your name and why you are in Poland first.", "incomplete_setup");
        return Response.json({ onboarding: await completeOnboarding(env, accountId) }, { headers: noStore });
      }
      case "restart":
        return Response.json({ onboarding: await restartOnboarding(env, accountId) }, { headers: noStore });
    }
  } catch (e) {
    return onboardingError(e);
  }
}
