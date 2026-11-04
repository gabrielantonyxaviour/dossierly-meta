import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { runInBackground } from "./background";
import { runCloudTask } from "./fallback";
import { randomId } from "../server/util";
import { InputSchemas, TraceStepSchema, type TaskInput, type TaskKind, type TraceStep } from "./schemas";
import { z } from "zod";

/** A queued task whose in-Worker run never started (the isolate was evicted) is picked up by the next poll after this. */
export const FALLBACK_AFTER_MS = 20_000;
/** A running task with no result this long is taken over and run again. */
export const STALE_CLAIM_MS = 180_000;
const MAX_INPUT_BYTES = 250_000;

export type TaskStatus = "queued" | "running" | "done" | "failed";
/** "sandbox" only appears on rows written before the agent moved into the Worker. */
export type RanOn = "cloud" | "sandbox";
export type TaskRow = {
  id: string;
  user_id: string;
  kind: TaskKind;
  status: TaskStatus;
  ran_on: RanOn | null;
  sandbox: string | null;
  input: string | null;
  trace: string;
  result: string | null;
  error: string | null;
  created_at: number;
  claimed_at: number | null;
  updated_at: number;
};
export type StoredResult = { data: unknown; run?: unknown };

const COLS = "id, user_id, kind, status, ran_on, sandbox, input, trace, result, error, created_at, claimed_at, updated_at";

/** Called by POST /api/prepare and by /api/agent/{ask,file}. Validates the input per kind and starts the run in the Worker. */
export async function enqueueAgentTask(
  env: Env,
  t: { userId: string; kind: TaskKind; input: unknown },
  opts: { start?: boolean; schedule?: (work: () => Promise<unknown>) => void; client?: ChatClient } = {},
): Promise<{ taskId: string }> {
  const input = InputSchemas[t.kind].parse(t.input) as TaskInput;
  const json = JSON.stringify(input);
  if (json.length > MAX_INPUT_BYTES) throw new z.ZodError([{ code: "custom", message: "input too large", path: ["input"] }]);
  const now = Date.now();
  const taskId = randomId("t", 12);
  const trace: TraceStep[] = [{ step: "queued for your agent", ms: 0 }];
  await env.DB.prepare(
    "INSERT INTO tasks (id, user_id, kind, status, input, trace, created_at, updated_at) VALUES (?,?,?,'queued',?,?,?,?)",
  ).bind(taskId, t.userId, t.kind, json, JSON.stringify(trace), now, now).run();
  if (opts.start !== false) {
    const row = await getTask(env, taskId);
    if (row && (await claimForCloud(env, row, now))) {
      const taken = (await getTask(env, taskId)) ?? row;
      (opts.schedule ?? runInBackground)(() => runCloudTask(env, taken, { client: opts.client, reason: "running in your agent" }));
    }
  }
  return { taskId };
}

export async function getTask(env: Env, id: string): Promise<TaskRow | null> {
  return env.DB.prepare(`SELECT ${COLS} FROM tasks WHERE id = ?`).bind(id).first<TaskRow>();
}

/** Takes a queued task (or a stale running one) for the Worker run. True only for the caller that wins the race. */
export async function claimForCloud(env: Env, row: Pick<TaskRow, "id" | "status" | "claimed_at">, now = Date.now()): Promise<boolean> {
  const stale = row.status === "running";
  const res = await env.DB.prepare(
    stale
      ? "UPDATE tasks SET ran_on = 'cloud', claimed_at = ?, updated_at = ? WHERE id = ? AND status = 'running' AND claimed_at = ?"
      : "UPDATE tasks SET status = 'running', ran_on = 'cloud', claimed_at = ?, updated_at = ? WHERE id = ? AND status = 'queued' AND ran_on IS NULL",
  ).bind(...(stale ? [now, now, row.id, row.claimed_at] : [now, now, row.id])).run();
  return (res.meta?.changes ?? 0) > 0;
}

export function parseTrace(raw: string | null): TraceStep[] {
  try {
    const p = z.array(TraceStepSchema).safeParse(JSON.parse(raw ?? "[]"));
    return p.success ? p.data : [];
  } catch {
    return [];
  }
}

/** Moves a running task to done/failed. The `status = 'running'` guard makes a second finish a no-op. */
export async function finishTask(
  env: Env,
  id: string,
  f: { status: "done" | "failed"; ranOn: RanOn; sandbox?: string | null; trace: TraceStep[]; result?: StoredResult; error?: string },
): Promise<boolean> {
  const res = await env.DB.prepare(
    "UPDATE tasks SET status = ?, ran_on = ?, sandbox = COALESCE(?, sandbox), trace = ?, result = ?, error = ?, updated_at = ? WHERE id = ? AND status = 'running'",
  ).bind(
    f.status, f.ranOn, f.sandbox ?? null, JSON.stringify(f.trace.slice(0, 40)),
    f.result ? JSON.stringify(f.result) : null, f.error ? f.error.slice(0, 300) : null, Date.now(), id,
  ).run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function appendTrace(env: Env, id: string, step: TraceStep): Promise<void> {
  const row = await getTask(env, id);
  if (!row) return;
  await env.DB.prepare("UPDATE tasks SET trace = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify([...parseTrace(row.trace), step].slice(0, 40)), Date.now(), id).run();
}

/** The GET /api/agent/tasks/:id body (BUILD.md contract, plus `run` and a safe `error`). */
export function taskView(row: TaskRow) {
  let stored: StoredResult | null = null;
  try {
    stored = row.result ? (JSON.parse(row.result) as StoredResult) : null;
  } catch {
    stored = null;
  }
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    ranOn: row.ran_on,
    trace: parseTrace(row.trace),
    ...(row.status === "done" && stored ? { result: stored.data, ...(stored.run ? { run: stored.run } : {}) } : {}),
    ...(row.status === "failed" ? { error: row.error ?? "The agent could not finish this task" } : {}),
  };
}

export async function setTrace(env: Env, id: string, trace: TraceStep[]): Promise<void> {
  await env.DB.prepare("UPDATE tasks SET trace = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(trace.slice(0, 40)), Date.now(), id).run();
}
