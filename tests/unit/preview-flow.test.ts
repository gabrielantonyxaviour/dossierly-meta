import { describe, expect, it } from "vitest";
import { caseClient } from "@/lib/case/client";
import { ensurePreviewCase, previewFlow, resetPreviewAccount } from "@/lib/dev/preview";
import { SAMPLE_LABEL_ID } from "@/lib/dev/sample-label";
import { freshLocalEnv } from "@/lib/server/local";
import type { Env } from "@/lib/server/env";

const envWith = (over: Record<string, unknown>) => ({ ...freshLocalEnv(), ...over }) as unknown as Env;
const user = async (env: Env, id: string) => { await env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at, account_kind) VALUES (?, ?, 'device')").bind(id, Date.now()).run(); };
const onboarded = async (env: Env, id: string) =>
  (await env.DB.prepare("SELECT completed_at FROM onboarding_progress WHERE account_id = ?").bind(id).first<{ completed_at: number | null }>())?.completed_at ?? null;

describe("flow-isolated previews", () => {
  it("is off in production and for unknown values", () => {
    expect(previewFlow(envWith({ APP_ENV: "production", PREVIEW_FLOW: "app" }))).toBeNull();
    expect(previewFlow(envWith({ APP_ENV: "preview", PREVIEW_FLOW: "nope" }))).toBeNull();
    expect(previewFlow(envWith({ APP_ENV: "preview", PREVIEW_FLOW: "voice" }))).toBe("voice");
  });

  it("seeds an empty case with the labelled sample and completes setup on a voice preview, once", async () => {
    const env = envWith({ APP_ENV: "preview", PREVIEW_FLOW: "voice" });
    await user(env, "pv-voice");
    expect(await ensurePreviewCase(env, "pv-voice", false)).toBe(true);
    const snap = await caseClient("pv-voice").snapshot();
    expect(snap.profile.fullName).toBe("Arjun Raman");
    expect(snap.events.some((e) => e.id === SAMPLE_LABEL_ID)).toBe(true);
    expect(await onboarded(env, "pv-voice")).not.toBeNull();
    const events = snap.events.length;
    expect(await ensurePreviewCase(env, "pv-voice", true)).toBe(false);
    expect((await caseClient("pv-voice").snapshot()).events.length).toBe(events);
  });

  it("never seeds on the onboarding preview", async () => {
    const env = envWith({ APP_ENV: "preview", PREVIEW_FLOW: "onboarding" });
    expect(await ensurePreviewCase(env, "pv-onb", false)).toBe(false);
    expect((await caseClient("pv-onb").snapshot()).events).toHaveLength(0);
  });

  it("start fresh wipes the case and setup; reseed restores the sample", async () => {
    const env = envWith({ APP_ENV: "preview", PREVIEW_FLOW: "app" });
    await user(env, "pv-reset");
    await ensurePreviewCase(env, "pv-reset", false);
    await resetPreviewAccount(env, "pv-reset", { reseed: false });
    const wiped = await caseClient("pv-reset").snapshot();
    expect([wiped.documents, wiped.deadlines, wiped.tasks, wiped.events, wiped.appointments].every((c) => c.length === 0)).toBe(true);
    expect(wiped.profile.fullName).toBeNull();
    expect(wiped.facts.caseNumber).toBeUndefined();
    expect(await onboarded(env, "pv-reset")).toBeNull();
    await resetPreviewAccount(env, "pv-reset", { reseed: true });
    expect((await caseClient("pv-reset").snapshot()).deadlines.length).toBeGreaterThan(0);
  });

  it("refuses to reset in production", async () => {
    await expect(resetPreviewAccount(envWith({ APP_ENV: "production" }), "pv-prod", { reseed: false })).rejects.toThrow();
  });
});
