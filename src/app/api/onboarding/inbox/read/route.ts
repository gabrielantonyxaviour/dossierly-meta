import { z } from "zod";
import { caseClient } from "@/lib/case/client";
import { readMail } from "@/lib/onboarding/extract";
import type { MailReading } from "@/lib/onboarding/findings";
import { readMessage } from "@/lib/onboarding/inbox";
import { withOnboarding } from "@/lib/onboarding/route";
import { readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";
const bodySchema = z.object({ messageId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), fresh: z.boolean().optional() }).strict();

/** Reads one email with Muse Spark and returns reviewable findings. Cached for a day so a reload costs nothing. */
export const POST = (req: Request) => withOnboarding(req, async ({ env, userId, accountId }) => {
  const { messageId, fresh } = await readJson(req, bodySchema);
  const key = `obscan:v7:${userId}:${messageId}`;
  if (!fresh) {
    const hit = await env.CACHE.get(key);
    if (hit) return JSON.parse(hit) as MailReading;
  }
  const profile = (await caseClient(userId).snapshot()).profile;
  const msg = await readMessage(env, accountId, messageId);
  const reading = await readMail(env, userId, msg, { fullName: profile.fullName, language: profile.preferredLanguage });
  await env.CACHE.put(key, JSON.stringify(reading), { expirationTtl: 86_400 });
  return reading;
});
