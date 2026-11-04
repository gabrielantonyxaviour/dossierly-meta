import { caseClient } from "@/lib/case/client";
import { warsawToday } from "@/lib/case/next-step";
import { COLLECTIONS, FACT_KEYS, defaultProfile } from "@/lib/case/types";
import type { Env } from "@/lib/server/env";
import { buildArjunSeed, storeSeedFiles } from "./arjun-seed";
import { SAMPLE_LABEL_ID } from "./sample-label";

/* Flow-isolated preview testing (Gabriel, 4 Nov). Never active in production: every helper checks APP_ENV. */

export type PreviewFlow = "onboarding" | "app" | "voice" | "look";
const FLOWS = new Set<string>(["onboarding", "app", "voice", "look"]);

/** The flow this preview Worker tests, or null on production/local without the var. */
export function previewFlow(env: Env): PreviewFlow | null {
  if (env.APP_ENV === "production") return null;
  const v = String((env as unknown as Record<string, unknown>).PREVIEW_FLOW ?? "");
  return FLOWS.has(v) ? (v as PreviewFlow) : null;
}

/** Where a signed-in tester lands on each preview. */
export const FLOW_HOME: Record<PreviewFlow, string> = { onboarding: "/onboarding", app: "/app", voice: "/app/counter", look: "/app/look" };


async function seed(env: Env, userId: string) {
  const cc = caseClient(userId);
  const s = buildArjunSeed(warsawToday());
  const files = await storeSeedFiles(env as unknown as Parameters<typeof storeSeedFiles>[0], userId).catch(() => ({}) as Record<string, string>);
  await cc.patchProfile(s.profile);
  await cc.patchFacts(s.facts);
  for (const doc of s.documents) await cc.create("documents", { ...doc, fileKey: files[doc.id] ?? null });
  for (const kind of ["deadlines", "appointments", "tasks", "events"] as const) {
    for (const item of s[kind]) await cc.create(kind, item);
  }
  await cc.create("events", {
    id: SAMPLE_LABEL_ID, type: "note", refs: [],
    summary: "Sample case: Arjun Raman and every item here are fictional, loaded so this preview has a case to show.",
  });
}

const isEmpty = (s: Awaited<ReturnType<ReturnType<typeof caseClient>["snapshot"]>>) =>
  COLLECTIONS.every((k) => s[k].length === 0);

/** Marks setup complete for the account (so /app opens). */
export async function completeOnboarding(env: Env, accountId: string) {
  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO onboarding_progress (account_id, step, language, completed_at, updated_at) VALUES (?, 6, 'en', ?, ?)").bind(accountId, now, now).run();
  await env.DB.prepare("UPDATE onboarding_progress SET completed_at = COALESCE(completed_at, ?) WHERE account_id = ?").bind(now, accountId).run();
}

/**
 * On app/voice/look previews: an account with an empty case gets Arjun's labelled sample case and a completed
 * setup, so each flow can be tested without onboarding. Returns true when it changed anything.
 */
export async function ensurePreviewCase(env: Env, accountId: string, onboarded: boolean): Promise<boolean> {
  const flow = previewFlow(env);
  if (!flow || flow === "onboarding") return false;
  const cc = caseClient(accountId);
  const snap = await cc.snapshot();
  const empty = isEmpty(snap);
  if (empty) await seed(env, accountId);
  if (!onboarded) await completeOnboarding(env, accountId);
  return empty || !onboarded;
}

/** Wipes the account's case and setup state (any preview, never production). */
export async function resetPreviewAccount(env: Env, accountId: string, opts: { reseed: boolean }) {
  if (env.APP_ENV === "production") throw new Error("not available");
  const cc = caseClient(accountId);
  const snap = await cc.snapshot();
  for (const kind of COLLECTIONS) for (const item of snap[kind]) await cc.remove(kind, item.id);
  await cc.patchFacts(Object.fromEntries(FACT_KEYS.map((k) => [k, null])));
  const { country: _country, ...profile } = defaultProfile();
  await cc.patchProfile(profile);
  if (opts.reseed) {
    await seed(env, accountId);
    await completeOnboarding(env, accountId);
  } else {
    await env.DB.prepare("DELETE FROM onboarding_progress WHERE account_id = ?").bind(accountId).run();
  }
}
