import { ApiError } from "../http";
import { verifyRemote } from "./broker";
import type { AccountRow, Category, ConnectionsEnv } from "./types";

export async function rowFor(env: ConnectionsEnv, accountId: string, category: Category) {
  return env.DB.prepare("SELECT * FROM connection_accounts WHERE account_id = ? AND category = ?").bind(accountId, category).first<AccountRow>();
}
export async function owned(env: ConnectionsEnv, accountId: string, category: Category) {
  const row = await rowFor(env, accountId, category);
  if (!row) throw new ApiError(409, "Connect an account to continue.", "connection_required");
  await verifyRemote(env, row); return row;
}
export async function budget(env: ConnectionsEnv, accountId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const r = await env.DB.prepare("INSERT INTO connection_usage (account_id, day, calls) VALUES (?, ?, 1) ON CONFLICT(account_id, day) DO UPDATE SET calls = calls + 1 WHERE calls < 400")
    .bind(accountId, day).run();
  if (r.meta?.changes !== 1) throw new ApiError(429, "Today's connection limit is reached. Try again tomorrow.", "connection_limit");
}
export async function saveRow(env: ConnectionsEnv, row: AccountRow) {
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO connection_retirements (account_id,broker_id,provider,auth_config_id,created_at) SELECT account_id,broker_id,provider,auth_config_id,? FROM connection_accounts AS old WHERE account_id=? AND category=? AND broker_id<>? AND NOT EXISTS (SELECT 1 FROM connection_accounts AS other WHERE other.account_id=old.account_id AND other.broker_id=old.broker_id AND other.category<>old.category)")
      .bind(Date.now(), row.account_id, row.category, row.broker_id),
    env.DB.prepare("INSERT INTO connection_accounts (account_id, category, provider, broker_id, auth_config_id, label, scopes, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(account_id, category) DO UPDATE SET provider=excluded.provider, broker_id=excluded.broker_id, auth_config_id=excluded.auth_config_id, label=excluded.label, scopes=excluded.scopes, connected_at=excluded.connected_at")
      .bind(row.account_id, row.category, row.provider, row.broker_id, row.auth_config_id, row.label, row.scopes, row.connected_at),
  ]);
}
export const publicRow = (r: AccountRow, status: "connected" | "reconnect") => ({ provider: r.provider, category: r.category, label: r.label, scopes: JSON.parse(r.scopes) as string[], connectedAt: r.connected_at, status });
