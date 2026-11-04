/*
 * Spark vision check of a candidate MOS application photo against the Polish ID-photo rules. It only reports;
 * the product never edits the face or background. Metered and recorded like every other model call.
 */
import { z } from "zod";
import { resolveRole } from "../model/roles";
import { callJson } from "../model/json";
import { makeRun } from "../model/cost";
import { assertModelsEnabled, meterClient } from "../model/meter";
import { createMetaClient } from "../model/meta";
import { ModelError, type ChatClient } from "../model/types";
import { recordLedger } from "../server/ledger";
import { recordRun, type Run } from "../server/runs";
import type { Env } from "../server/env";

export const CHECK_IDS = ["background", "frontal", "expression", "eyes", "lighting", "head_covering", "glasses", "sharpness", "single_person"] as const;
export type CheckId = (typeof CHECK_IDS)[number];
export type CheckStatus = "pass" | "fail" | "unsure";

export const CHECK_LABELS: Record<CheckId, string> = {
  background: "Plain, light background",
  frontal: "Facing the camera straight on",
  expression: "Neutral expression, mouth closed",
  eyes: "Eyes open and clearly visible",
  lighting: "Even light, no shadows on the face",
  head_covering: "No hat or head covering",
  glasses: "No glare or dark lenses on glasses",
  sharpness: "Sharp and in focus",
  single_person: "Only you in the photo",
};

export interface PhotoCheck { id: CheckId; label: string; status: CheckStatus; note: string }

const modelSchema = z.object({
  checks: z.array(z.object({ id: z.string(), status: z.enum(["pass", "fail", "unsure"]), note: z.string().max(300) })).min(1),
});

const JSON_SCHEMA = {
  type: "object",
  properties: {
    checks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", enum: [...CHECK_IDS] },
          status: { type: "string", enum: ["pass", "fail", "unsure"] },
          note: { type: "string" },
        },
        required: ["id", "status", "note"],
      },
    },
  },
  required: ["checks"],
};

const SYSTEM = `You check whether a photo meets the Polish ID-photo rules used for a residence-permit application (35x45 mm, colour).
Judge only what is visible. Rules per check id:
- background: plain, evenly lit, light (white or very light grey). Fail for patterns, objects, flags, dark or saturated colours, visible shadows on the background.
- frontal: head straight and not tilted, face turned fully to the camera, looking at the lens. Fail for profile, a clear turn or a tilt.
- expression: natural, neutral, mouth closed, no smile showing teeth, no grimace.
- eyes: both eyes naturally open, pupils clearly visible, no red-eye, not hidden by hair or frames.
- lighting: even across the face, no harsh shadows, no shiny reflections on skin or hair.
- head_covering: pass when nothing covers the head or hairline. A religious covering is allowed if the whole face oval and ears line are visible; mention it and mark "unsure" because a certificate is needed. Fail for caps, hats, hoods.
- glasses: pass when there are no glasses, or clear lenses without glare and frames not covering the eyebrows. Fail for glare or dark lenses.
- sharpness: face in focus, no motion blur, no heavy compression, no beauty filter look.
- single_person: only one person, no other faces or hands near the face.
Return exactly one entry per id (all nine). Use "unsure" whenever you cannot tell: never guess a pass. Each note is one short plain-English sentence a newcomer understands, saying what you see and, for fail or unsure, what to change. Do not comment on age, looks or identity.`;

export interface PhotoCheckCtx { env: Env; userId: string | null; client?: ChatClient }

const UNSURE_NOTE = "We couldn't judge this one from the photo.";

/** Fills any check the model skipped with an honest "unsure", in the fixed display order. */
export function normaliseChecks(raw: Array<{ id: string; status: CheckStatus; note: string }>): PhotoCheck[] {
  const byId = new Map<string, { status: CheckStatus; note: string }>();
  for (const c of raw) if (!byId.has(c.id)) byId.set(c.id, c);
  return CHECK_IDS.map((id) => {
    const c = byId.get(id);
    return { id, label: CHECK_LABELS[id], status: c?.status ?? "unsure", note: (c?.note ?? "").trim() || UNSURE_NOTE };
  });
}

async function safely(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch {
    /* bookkeeping must never fail a user request */
  }
}

export async function photoCheck(ctx: PhotoCheckCtx, args: { image: string }): Promise<{ checks: PhotoCheck[]; run: Run; ms: number }> {
  assertModelsEnabled(ctx.env);
  const cfg = resolveRole("vision", ctx.env);
  if (!ctx.client && !cfg.apiKey) throw new ModelError("The model service is not configured", "no_key", 503);
  const client = meterClient(ctx.env, ctx.client ?? createMetaClient(ctx.env));
  const t0 = Date.now();
  const messages = [
    { role: "system" as const, content: SYSTEM },
    { role: "user" as const, content: [{ type: "text" as const, text: "Check this photo." }, { type: "image_url" as const, image_url: { url: args.image } }] },
  ];
  const res = await callJson(
    client,
    { model: cfg.model, role: "vision", messages, maxTokens: 4500, reasoningEffort: "low", json: JSON_SCHEMA },
    modelSchema,
  );
  const ms = Date.now() - t0;
  const run = makeRun(cfg.model, ms, res.usage, "cloud");
  await safely(recordLedger(ctx.env, { userId: ctx.userId, kind: "model", what: cfg.model, action: "allowed", bytes: args.image.length, masked: 0, detail: { task: "photo_check", role: "vision" } }));
  await safely(recordRun(ctx.env, ctx.userId, run, "photo_check"));
  return { checks: normaliseChecks(res.data.checks as Array<{ id: string; status: CheckStatus; note: string }>), run, ms };
}
