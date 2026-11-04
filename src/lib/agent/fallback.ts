import { costUsd, makeRun } from "../model/cost";
import { extractJson } from "../model/json";
import { ModelError } from "../model/types";
import { assertModelsEnabled, meterClient } from "../model/meter";
import { createMetaClient } from "../model/meta";
import { resolveRole } from "../model/roles";
import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { recordLedger } from "../server/ledger";
import { recordRun, type Run } from "../server/runs";
import { applyCaseStatus, enforceAskCitations, enforcePrepareCitations } from "./citations";
import { renderCaseMemory } from "./case-memory";
import { DIRECT_ANSWER_NOTE, fillPrompt } from "./prompt";
import { PROMPT_TEXT } from "./prompt-text";
import { finishTask, parseTrace, type TaskRow } from "./queue";
import {
  AskResultSchema, FileInputSchema, InputSchemas, PrepareResultSchema, ResultSchemas,
  type AskInput, type PrepareInput, type TraceStep,
} from "./schemas";

/** The case memory, task input, passages and playbook, rendered as labelled sections for one model call. */
export function buildCloudMessages(row: Pick<TaskRow, "kind" | "input">) {
  const input = InputSchemas[row.kind].parse(JSON.parse(row.input ?? "{}"));
  const { passages = [], skill, ...rest } = input as typeof input & { passages?: unknown[]; skill?: string };
  const memory = renderCaseMemory(input.case);
  const files = [
    `=== CASE MEMORY ===\n${memory}`,
    `=== TASK INPUT ===\n${JSON.stringify(rest)}`,
    `=== PASSAGES ===\n${JSON.stringify(passages)}`,
    `=== PLAYBOOK ===\n${skill ?? "(none)"}`,
  ].join("\n\n");
  const language = "language" in input ? input.language : "en";
  return {
    messages: [
      { role: "system" as const, content: `${fillPrompt(PROMPT_TEXT[row.kind], language)}\n\n${DIRECT_ANSWER_NOTE}` },
      { role: "user" as const, content: files },
    ],
    input,
  };
}

export function finalise(kind: TaskRow["kind"], raw: unknown, input: unknown): { data: unknown; note?: string } {
  const parsed = ResultSchemas[kind].parse(raw);
  if (kind === "prepare") {
    const prep = input as PrepareInput;
    const { result: cited, report } = enforcePrepareCitations(PrepareResultSchema.parse(parsed), prep.passages);
    if (cited.checklist.length === 0) throw new Error("no checklist item could be tied to an official passage");
    const result = applyCaseStatus(cited, prep.case.documents);
    return { data: result, note: report.dropped || report.repaired ? `citations: ${report.dropped} dropped, ${report.repaired} repaired` : undefined };
  }
  if (kind === "ask") {
    const { result, report } = enforceAskCitations(AskResultSchema.parse(parsed), (input as AskInput).passages);
    return { data: result, note: report.dropped ? `citations: ${report.dropped} dropped` : undefined };
  }
  return { data: parsed };
}

/** Runs one claimed task in the Worker with the agent role (Muse Spark). The caller must have won claimForCloud. */
export async function runCloudTask(
  env: Env,
  row: TaskRow,
  opts: { client?: ChatClient; reason?: string } = {},
): Promise<void> {
  const trace: TraceStep[] = [...parseTrace(row.trace), { step: opts.reason ?? "running in your agent", ms: 0 }];
  const started = Date.now();
  const fail = (error: string) => finishTask(env, row.id, { status: "failed", ranOn: "cloud", trace, error });
  try {
    if (row.kind === "file") {
      // The case itself lives on the device and is sent with every request, so filing needs no model call.
      const ev = FileInputSchema.parse(JSON.parse(row.input ?? "{}")).event;
      trace.push({ step: "event filed with the case on your device", ms: Date.now() - started });
      await finishTask(env, row.id, {
        status: "done", ranOn: "cloud", trace,
        result: { data: { filed: true, memoryUpdated: false, summary: `Saved on your device: ${ev.title}. It is included in every later answer about your case.` } },
      });
      return;
    }
    const { messages, input } = buildCloudMessages(row);
    // Metered per call: over the daily cap (or with models switched off) the task fails with that message; it never spends.
    assertModelsEnabled(env);
    const cfg = resolveRole("agent", env);
    if (!opts.client && !cfg.apiKey) throw new ModelError("The model service is not configured", "no_key", 503);
    const client = meterClient(env, opts.client ?? createMetaClient(env));
    let usage = { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
    let lastError = "";
    let lastRaw = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const msgs = attempt === 0 ? messages : [
        ...messages,
        { role: "assistant" as const, content: lastRaw.slice(0, 2000) || "(empty)" },
        { role: "user" as const, content: `That was not valid: ${lastError}. Reply again with only the corrected JSON object.` },
      ];
      const res = await client.chat({ model: cfg.model, role: "agent", messages: msgs, maxTokens: 6000, reasoningEffort: cfg.effort, json: "json_object" });
      usage = {
        tokensIn: usage.tokensIn + res.usage.tokensIn, tokensOut: usage.tokensOut + res.usage.tokensOut,
        cachedTokens: usage.cachedTokens + res.usage.cachedTokens,
      };
      lastRaw = res.content;
      try {
        const { data, note } = finalise(row.kind, extractJson(res.content), input);
        const ms = Date.now() - started;
        trace.push({ step: "Muse Spark answered", tool: "meta", ms });
        if (note) trace.push({ step: note, ms: 0 });
        const run: Run = makeRun(cfg.model, ms, usage, "cloud");
        await finishTask(env, row.id, { status: "done", ranOn: "cloud", trace, result: { data, run } });
        await recordRun(env, row.user_id, run, `agent:${row.kind}`);
        await recordLedger(env, {
          userId: row.user_id, kind: "model", what: `${cfg.model}, ${row.kind}`,
          action: "allowed", detail: { ranOn: "worker", costUsd: costUsd(cfg.model, usage), attempts: attempt + 1 },
        });
        return;
      } catch (err) {
        lastError = err instanceof Error ? err.message.slice(0, 200) : "unparseable";
      }
    }
    await fail(`The model answer failed validation (${lastError})`);
  } catch (err) {
    await fail(err instanceof Error && err.name === "ModelError" ? err.message : "The agent could not finish this task");
  }
}
