import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import { runInBackground } from "./background";
import { runCloudTask } from "./fallback";
import { FALLBACK_AFTER_MS, STALE_CLAIM_MS, claimForCloud, getTask, type TaskRow } from "./queue";

type Deps = { schedule?: (work: () => Promise<unknown>) => void; client?: ChatClient };

/**
 * Called on every status poll. Tasks start in the Worker when they are enqueued; this is the safety net for a
 * task that never started (queued past FALLBACK_AFTER_MS) or whose run went silent (running past STALE_CLAIM_MS).
 * The takeover is an atomic UPDATE, so exactly one caller runs it.
 */
export async function advanceTask(env: Env, row: TaskRow, now = Date.now(), deps: Deps = {}): Promise<TaskRow> {
  const unstarted = row.status === "queued" && now - row.created_at >= FALLBACK_AFTER_MS;
  const stale = row.status === "running" && row.claimed_at !== null && now - row.claimed_at >= STALE_CLAIM_MS;
  if (!unstarted && !stale) return row;
  if (!(await claimForCloud(env, row, now))) return (await getTask(env, row.id)) ?? row;
  const taken = (await getTask(env, row.id)) ?? row;
  const reason = stale ? "the earlier run stopped answering, running it again" : "the task had not started, running it now";
  (deps.schedule ?? runInBackground)(() => runCloudTask(env, taken, { client: deps.client, reason }));
  return taken;
}
