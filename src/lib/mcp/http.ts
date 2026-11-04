/* HTTP edge of the MCP server: Bearer auth, per-token rate limit, body limits, JSON-RPC dispatch. */
import { getEnv } from "../server/env";
import { errorResponse, jsonError } from "../server/http";
import { rateLimit } from "../server/ratelimit";
import { handleMessage, rpcError, RPC_CODES } from "./protocol";
import { authenticateToken } from "./tokens";
import type { McpDeps } from "./types";

const MAX_BODY = 8_000_000;
export const REQUESTS_PER_MINUTE = 60;
const noStore = { "cache-control": "no-store" };

export async function handleMcpPost(req: Request, deps: McpDeps = {}): Promise<Response> {
  try {
    return await dispatch(req, deps);
  } catch (e) {
    return errorResponse(e);
  }
}

async function dispatch(req: Request, deps: McpDeps): Promise<Response> {
  const env = getEnv();
  const principal = await authenticateToken(env, req.headers.get("authorization"));
  if (!principal) {
    return jsonError(401, "Missing or invalid token. Create one in Dossierly and send it as 'Authorization: Bearer <token>'.", "unauthorized", {
      ...noStore, "www-authenticate": 'Bearer realm="dossierly-mcp"',
    });
  }
  const rl = await rateLimit(env, principal.accountId, `mcp:${principal.tokenId}`, REQUESTS_PER_MINUTE, 60);
  if (!rl.ok) return jsonError(429, "Too many requests for this token.", "rate_limited", { ...noStore, "retry-after": String(rl.retryAfterSec) });
  if (Number(req.headers.get("content-length")) > MAX_BODY) return jsonError(413, "Request is too large", "too_large", noStore);

  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return Response.json(rpcError(null, RPC_CODES.parse, "Parse error"), { status: 400, headers: noStore });
  }
  const ctx = { env, principal, deps };
  if (Array.isArray(body)) {
    if (body.length === 0 || body.length > 20) return Response.json(rpcError(null, RPC_CODES.request, "Batch must have 1 to 20 messages"), { status: 400, headers: noStore });
    const out = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter((r) => r !== null);
    return out.length ? Response.json(out, { headers: noStore }) : new Response(null, { status: 202, headers: noStore });
  }
  const out = await handleMessage(body, ctx);
  return out ? Response.json(out, { headers: noStore }) : new Response(null, { status: 202, headers: noStore });
}

/** This server offers no server-initiated stream, so GET (SSE) and DELETE (session end) are 405 as the spec allows. */
export const methodNotAllowed = () => jsonError(405, "Use POST with a JSON-RPC message.", "method_not_allowed", { allow: "POST", ...noStore });
