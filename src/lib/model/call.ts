import type { ZodType } from "zod";
import { TASK_ROLE, type ModelTask, type ReasoningEffort } from "../config";
import type { Masker } from "../mask";
import type { Env } from "../server/env";
import { recordLedger } from "../server/ledger";
import { recordRun, type Run } from "../server/runs";
import { makeRun } from "./cost";
import { callJson } from "./json";
import { assertModelsEnabled, meterClient } from "./meter";
import { createMetaClient } from "./meta";
import { resolveRole } from "./roles";
import type { ChatClient, ChatMessage, ContentPart } from "./types";
import { ModelError } from "./types";

export interface Ctx {
  env: Env;
  userId: string | null;
  /** Test double; production builds the Meta client from env (MODEL_API_KEY and the per-role overrides). */
  client?: ChatClient;
}

export interface ModelCall<T> {
  task: ModelTask;
  /** Rules and schema only: a stable prefix, never user data, never masked. */
  system: string;
  /** Case context. Masked here before it leaves. */
  context?: string;
  /** The new input. Masked here before it leaves. */
  input: string;
  /** Data URLs. Pixels cannot be masked, so these only go to the vision model. */
  images?: string[];
  schema: ZodType<T>;
  maxTokens: number;
  /** Overrides the role default reasoning effort. */
  effort?: ReasoningEffort;
  masker: Masker;
  /** Recorded stand-in, served as ranOn "replay" only for local fixture mode (APP_ENV local, no key). Never in production. */
  replay: () => T;
  json?: "json_object" | Record<string, unknown>;
}

export interface ModelOut<T> {
  data: T;
  run: Run;
  masked: number;
  raw: string;
}

function buildMessages(call: { system: string; context?: string; input: string; images?: string[] }): ChatMessage[] {
  // Order is the cache key: rules, then case context, then the new input.
  const text = `${call.context ? `CASE CONTEXT\n${call.context}\n\n` : ""}INPUT\n${call.input}`;
  const user: string | ContentPart[] = call.images?.length
    ? [{ type: "text", text }, ...call.images.map((url): ContentPart => ({ type: "image_url", image_url: { url } }))]
    : text;
  return [
    { role: "system", content: call.system },
    { role: "user", content: user },
  ];
}

async function safely(p: Promise<unknown>): Promise<void> {
  try {
    await p;
  } catch {
    /* bookkeeping must never fail a user request */
  }
}

/** Recorded answers exist for local development and tests only; a deployed Worker never serves them. */
const fixtureMode = (env: Env) => env.APP_ENV === "local" && process.env.DEMO_FIXTURES === "1";

export async function runModel<T>(ctx: Ctx, call: ModelCall<T>): Promise<ModelOut<T>> {
  assertModelsEnabled(ctx.env);
  const role = TASK_ROLE[call.task];
  const cfg = resolveRole(role, ctx.env);
  const model = cfg.model;
  const context = call.context ? call.masker.mask(call.context) : undefined;
  const input = call.masker.mask(call.input);
  const masked = call.masker.count;
  const messages = buildMessages({ system: call.system, context, input, images: call.images });
  const bytes = JSON.stringify(messages).length;

  const replay = async (): Promise<ModelOut<T>> => {
    const data = call.replay();
    const run = makeRun(model, 40, { tokensIn: 0, tokensOut: 0, cachedTokens: 0 }, "replay");
    await safely(recordRun(ctx.env, ctx.userId, run, call.task));
    return { data, run, masked, raw: "" };
  };

  if (!ctx.client && !cfg.apiKey) {
    if (fixtureMode(ctx.env)) return replay();
    throw new ModelError("The model service is not configured", "no_key", 503);
  }

  // Each call to the model (the corrective JSON retry included) reserves its own upper bound against the
  // $-per-day cap and settles to actual usage; over the cap it throws over_budget.
  const client = meterClient(ctx.env, ctx.client ?? createMetaClient(ctx.env));
  const t0 = Date.now();
  const res = await callJson(
    client,
    { model, role, messages, maxTokens: call.maxTokens, reasoningEffort: call.effort ?? cfg.effort, json: call.json ?? "json_object" },
    call.schema,
  );
  const run = makeRun(model, Date.now() - t0, res.usage, "cloud");
  await safely(recordLedger(ctx.env, { userId: ctx.userId, kind: "model", what: model, action: "allowed", bytes, masked, detail: { task: call.task, role } }));
  await safely(recordRun(ctx.env, ctx.userId, run, call.task));
  return { data: call.masker.restoreDeep(res.data), run, masked, raw: res.raw };
}
