import { caseClient } from "@/lib/case/client";
import { warsawToday } from "@/lib/case/next-step";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { getEnv, type Env } from "@/lib/server/env";
import { jsonError } from "@/lib/server/http";
import { accountFromCookie, sessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const DEMO_ID = "dev-arjun";

async function seedIfEmpty(userId: string, force: boolean) {
  const cc = caseClient(userId);
  const snap = await cc.snapshot();
  const empty = !snap.documents.length && !snap.deadlines.length && !snap.tasks.length && !snap.events.length && !snap.appointments.length;
  if (!empty && !force) return;
  if (!empty) {
    for (const kind of ["documents", "deadlines", "appointments", "tasks", "events"] as const) {
      for (const item of snap[kind]) await cc.remove(kind, item.id);
    }
  }
  const seed = buildArjunSeed(warsawToday());
  await cc.patchProfile(seed.profile);
  await cc.patchFacts(seed.facts);
  for (const kind of ["documents", "deadlines", "appointments", "tasks", "events"] as const) {
    for (const item of seed[kind]) await cc.create(kind, item);
  }
}

async function completeOnboarding(env: Env, accountId: string, now: number) {
  await env.DB.prepare("INSERT OR IGNORE INTO onboarding_progress (account_id, step, language, completed_at, updated_at) VALUES (?, 6, 'en', ?, ?)").bind(accountId, now, now).run();
  await env.DB.prepare("UPDATE onboarding_progress SET completed_at = COALESCE(completed_at, ?) WHERE account_id = ?").bind(now, accountId).run();
}

const target = (req: Request) => {
  const next = new URL(req.url).searchParams.get("next");
  return next && /^\/app(\/|\?|$)/.test(next) ? next : "/app";
};

/**
 * Review helper, never in production.
 * - local: signs in as a seeded demo user (no email sign-in needed).
 * - preview: for the ALREADY signed-in account only, fills an empty case with Arjun's demo case and marks setup
 *   complete so the app screens can be reviewed. `?reset=1` replaces the existing case. Never creates accounts.
 */
export async function GET(req: Request) {
  const env = getEnv();
  if (env.APP_ENV !== "local" && env.APP_ENV !== "preview") return jsonError(404, "Not found");
  const reset = new URL(req.url).searchParams.get("reset") === "1";
  try {
    const now = Date.now();
    if (env.APP_ENV === "preview") {
      const account = await accountFromCookie(req.headers.get("cookie"), env);
      if (!account) return jsonError(401, "Sign in first", "no_session");
      await completeOnboarding(env, account.accountId, now);
      await seedIfEmpty(account.accountId, reset);
      return new Response(null, { status: 302, headers: { location: target(req), "cache-control": "no-store" } });
    }
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at, account_kind) VALUES (?, ?, 'device')").bind(DEMO_ID, now),
      env.DB.prepare("INSERT OR IGNORE INTO email_identities (email, user_id, verified_at) VALUES (?, ?, ?)").bind("arjun.raman@example.com", DEMO_ID, now),
    ]);
    await completeOnboarding(env, DEMO_ID, now);
    await seedIfEmpty(DEMO_ID, reset);
    return new Response(null, { status: 302, headers: { location: target(req), "set-cookie": await sessionCookie(DEMO_ID, env), "cache-control": "no-store" } });
  } catch {
    return jsonError(500, "Could not seed the demo case", "seed_failed");
  }
}
