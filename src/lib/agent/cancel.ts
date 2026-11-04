import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import { getTask } from "./queue";

export const CANCELLED_MESSAGE = "Request stopped by you. A provider call already started may still finish and count toward usage.";
/** Terminal task state makes late results a no-op. Ownership uses the actual account, never the shared sample id. */
export async function cancelTask(env: Env, id: string, accountId: string): Promise<void> {
  const row = await getTask(env, id);
  if (!row || row.user_id !== accountId) throw new ApiError(404, "Task not found", "not_found");
  await env.DB.prepare("UPDATE tasks SET status='failed',error=?,input=NULL,result=NULL,updated_at=? WHERE id=? AND user_id=? AND status IN ('queued','running')")
    .bind(CANCELLED_MESSAGE, Date.now(), id, accountId).run();
}
