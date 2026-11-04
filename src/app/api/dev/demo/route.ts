import { caseClient } from "@/lib/case/client";
import { completeOnboarding, resetPreviewAccount } from "@/lib/dev/preview";
import { writeReadyScene } from "@/lib/dev/ready-scene";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { warsawToday } from "@/lib/case/next-step";
import { getEnv } from "@/lib/server/env";
import { jsonError } from "@/lib/server/http";
import { accountFromCookie, sessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const DEMO_ID = "dev-arjun";

const target = (req: Request) => {
  const next = new URL(req.url).searchParams.get("next");
  return next && /^\/app(\/|\?|$)/.test(next) ? next : new URL(req.url).searchParams.get("scene") === "ready" ? "/app/ready" : "/app";
};

/**
 * Review helper, never in production.
 * - local: signs in as a seeded demo user (no email sign-in needed).
 * - preview: for the ALREADY signed-in account, `?reset=1` replaces the case with Arjun's labelled sample case.
 *   (Empty cases on app/voice/look previews are seeded automatically by the /app layout.) Never creates accounts.
 * - both: `?scene=ready` adds the labelled "new letter + drafts" scene so /app/ready can be checked (next defaults to it).
 */
export async function GET(req: Request) {
  const env = getEnv();
  if (env.APP_ENV !== "local" && env.APP_ENV !== "preview") return jsonError(404, "Not found");
  try {
    if (env.APP_ENV === "preview") {
      const account = await accountFromCookie(req.headers.get("cookie"), env);
      if (!account) return jsonError(401, "Sign in first", "no_session");
      const q = new URL(req.url).searchParams;
      if (q.get("reset") === "1") await resetPreviewAccount(env, account.accountId, { reseed: true });
      else await completeOnboarding(env, account.accountId);
      if (q.get("scene") === "ready") await writeReadyScene(account.accountId);
      return new Response(null, { status: 302, headers: { location: target(req), "cache-control": "no-store" } });
    }
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at, account_kind) VALUES (?, ?, 'device')").bind(DEMO_ID, now),
      env.DB.prepare("INSERT OR IGNORE INTO email_identities (email, user_id, verified_at) VALUES (?, ?, ?)").bind("arjun.raman@example.com", DEMO_ID, now),
    ]);
    await completeOnboarding(env, DEMO_ID);
    const cc = caseClient(DEMO_ID);
    const snap = await cc.snapshot();
    if (!snap.events.length && !snap.documents.length) {
      const s = buildArjunSeed(warsawToday());
      await cc.patchProfile(s.profile);
      await cc.patchFacts(s.facts);
      for (const kind of ["documents", "deadlines", "appointments", "tasks", "events"] as const) for (const item of s[kind]) await cc.create(kind, item);
    }
    if (new URL(req.url).searchParams.get("scene") === "ready") await writeReadyScene(DEMO_ID);
    return new Response(null, { status: 302, headers: { location: target(req), "set-cookie": await sessionCookie(DEMO_ID, env), "cache-control": "no-store" } });
  } catch {
    return jsonError(500, "Could not seed the demo case", "seed_failed");
  }
}
