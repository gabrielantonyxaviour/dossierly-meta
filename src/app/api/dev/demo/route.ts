import { caseClient } from "@/lib/case/client";
import { warsawToday } from "@/lib/case/next-step";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { getEnv } from "@/lib/server/env";
import { jsonError } from "@/lib/server/http";
import { sessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const DEMO_ID = "dev-arjun";

/** Local-only: signs in as the seeded demo user so the UI can be iterated on without email sign-in. */
export async function GET(req: Request) {
  const env = getEnv();
  if (env.APP_ENV !== "local") return jsonError(404, "Not found");
  try {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at, account_kind) VALUES (?, ?, 'device')").bind(DEMO_ID, now),
      env.DB.prepare("INSERT OR IGNORE INTO email_identities (email, user_id, verified_at) VALUES (?, ?, ?)").bind("arjun.raman@example.com", DEMO_ID, now),
      env.DB.prepare("INSERT OR IGNORE INTO onboarding_progress (account_id, step, language, completed_at, updated_at) VALUES (?, 6, 'en', ?, ?)").bind(DEMO_ID, now, now),
    ]);
    await env.DB.prepare("UPDATE onboarding_progress SET completed_at = COALESCE(completed_at, ?) WHERE account_id = ?").bind(now, DEMO_ID).run();

    const cc = caseClient(DEMO_ID);
    const snap = await cc.snapshot();
    const empty = !snap.documents.length && !snap.deadlines.length && !snap.tasks.length && !snap.events.length && !snap.appointments.length;
    if (empty) {
      const seed = buildArjunSeed(warsawToday());
      await cc.patchProfile(seed.profile);
      await cc.patchFacts(seed.facts);
      for (const kind of ["documents", "deadlines", "appointments", "tasks", "events"] as const) {
        for (const item of seed[kind]) await cc.create(kind, item);
      }
    }
    const next = new URL(req.url).searchParams.get("next");
    const path = next && /^\/app(\/|\?|$)/.test(next) ? next : "/app";
    return new Response(null, { status: 302, headers: { location: path, "set-cookie": await sessionCookie(DEMO_ID, env), "cache-control": "no-store" } });
  } catch {
    return jsonError(500, "Could not seed the demo case", "seed_failed");
  }
}
