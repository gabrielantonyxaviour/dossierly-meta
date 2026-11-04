/* Personal access tokens for the MCP server. Plaintext is returned once at creation; D1 keeps only SHA-256. */
import type { Env } from "../server/env";
import { ApiError } from "../server/http";
import { randomId, sha256Hex } from "../server/util";

export type McpScope = "read" | "act";
export const MAX_ACTIVE_TOKENS = 10;

export interface TokenInfo {
  id: string;
  name: string;
  scope: McpScope;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}
export interface TokenPrincipal {
  tokenId: string;
  accountId: string;
  /** The case this token reads and writes (the account's own case, or the shared sample case, read-only). */
  caseUserId: string;
  scope: McpScope;
}

type Row = { id: string; name: string; scope: McpScope; prefix: string; created_at: number; last_used_at: number | null };
const iso = (n: number | null) => (n ? new Date(n).toISOString() : null);
const info = (r: Row): TokenInfo => ({ id: r.id, name: r.name, scope: r.scope, prefix: r.prefix, createdAt: iso(r.created_at) as string, lastUsedAt: iso(r.last_used_at) });

/** Creates a token and returns its plaintext exactly once. */
export async function createToken(env: Env, a: { accountId: string; caseUserId: string; name: string; scope: McpScope }): Promise<TokenInfo & { token: string }> {
  const active = await listTokens(env, a.accountId);
  if (active.length >= MAX_ACTIVE_TOKENS) throw new ApiError(409, `You can have at most ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`, "too_many_tokens");
  const token = `dsl_${randomId("t", 32).slice(2)}`;
  const id = randomId("mt", 9);
  const now = Date.now();
  const prefix = token.slice(0, 8);
  await env.DB.prepare(
    "INSERT INTO mcp_tokens (id, account_id, case_user_id, name, scope, token_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, a.accountId, a.caseUserId, a.name, a.scope, await sha256Hex(token), prefix, now).run();
  return { id, name: a.name, scope: a.scope, prefix, createdAt: new Date(now).toISOString(), lastUsedAt: null, token };
}

export async function listTokens(env: Env, accountId: string): Promise<TokenInfo[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, scope, prefix, created_at, last_used_at FROM mcp_tokens WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
  ).bind(accountId).all<Row>();
  return results.map(info);
}

export async function revokeToken(env: Env, accountId: string, id: string): Promise<void> {
  const res = await env.DB.prepare("UPDATE mcp_tokens SET revoked_at = ? WHERE id = ? AND account_id = ? AND revoked_at IS NULL")
    .bind(Date.now(), id, accountId).run();
  if ((res.meta?.changes ?? 0) === 0) throw new ApiError(404, "Token not found", "not_found");
}

/** Resolves a Bearer token to its principal; null when unknown or revoked. Touches last_used_at at most once a minute. */
export async function authenticateToken(env: Env, header: string | null): Promise<TokenPrincipal | null> {
  const m = /^Bearer\s+(dsl_[A-Za-z0-9_-]{20,80})$/.exec(header?.trim() ?? "");
  if (!m) return null;
  const row = await env.DB.prepare(
    "SELECT id, account_id, case_user_id, scope, last_used_at FROM mcp_tokens WHERE token_hash = ? AND revoked_at IS NULL",
  ).bind(await sha256Hex(m[1])).first<{ id: string; account_id: string; case_user_id: string; scope: McpScope; last_used_at: number | null }>();
  if (!row) return null;
  if (!row.last_used_at || Date.now() - row.last_used_at > 60_000) {
    await env.DB.prepare("UPDATE mcp_tokens SET last_used_at = ? WHERE id = ?").bind(Date.now(), row.id).run().catch(() => undefined);
  }
  return { tokenId: row.id, accountId: row.account_id, caseUserId: row.case_user_id, scope: row.scope };
}
