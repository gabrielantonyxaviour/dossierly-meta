import type { Env } from "../server/env";
import { disconnect } from "../server/connections/service";
import { rowFor } from "../server/connections/store";
import type { ConnectionsEnv } from "../server/connections/types";
import { resetPreviewAccount } from "./preview";

/**
 * Previews only: a true first run for the signed-in account (film takes, QA). Empty case, setup from the start,
 * Gmail and the calendar disconnected, and the inbox watcher's memory cleared so nothing old counts as new.
 */
export async function freshFirstRun(env: Env, accountId: string, opts: { disconnect: boolean }): Promise<void> {
  if (env.APP_ENV === "production") throw new Error("not available");
  await resetPreviewAccount(env, accountId, { reseed: false });
  if (!opts.disconnect) return;
  for (const category of ["mail", "calendar"] as const) {
    if (await rowFor(env as ConnectionsEnv, accountId, category)) await disconnect(env as ConnectionsEnv, accountId, category);
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM watch_messages WHERE account_id = ?").bind(accountId),
    env.DB.prepare("DELETE FROM watch_accounts WHERE account_id = ?").bind(accountId),
  ]);
}
