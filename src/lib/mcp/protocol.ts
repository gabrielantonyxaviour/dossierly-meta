/* Minimal MCP (Model Context Protocol) server core: JSON-RPC 2.0 over Streamable HTTP, POST only. */
import { z } from "zod";
import { ModelError } from "../model";
import { CaseClientError } from "../case/client";
import { ApiError } from "../server/http";
import { rateLimit } from "../server/ratelimit";
import { TOOLS, findTool } from "./tools";
import { McpToolError, type ToolContext } from "./types";

export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const SERVER_INFO = { name: "dossierly", title: "Dossierly caseworker", version: "1.0.0" };
const INSTRUCTIONS =
  "Dossierly is a verified toolbox for a newcomer's Polish temporary-residence case. Deadlines are computed by deterministic code with verbatim KPA citations. " +
  "Everything here is guidance, never legal advice; nothing is ever submitted to a government system. Prefer next_step for 'what should I do now?'.";

const E = { parse: -32700, request: -32600, method: -32601, params: -32602, internal: -32603 } as const;
type Id = string | number | null;
const rpcError = (id: Id, code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0" as const, id, error: { code, message, ...(data === undefined ? {} : { data }) } });
const rpcResult = (id: Id, result: unknown) => ({ jsonrpc: "2.0" as const, id, result });

const messageSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

function toolResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    ...(isError ? {} : { structuredContent: value }),
    isError,
  };
}
const toolError = (code: string, error: string) => toolResult({ error, code }, true);

function mapToolFailure(e: unknown) {
  if (e instanceof McpToolError) return toolError(e.code, e.message);
  if (e instanceof ModelError) return toolError(e.code, e.message);
  if (e instanceof CaseClientError) return toolError(e.code ?? "case_error", e.message);
  if (e instanceof ApiError) return toolError(e.code ?? "error", e.message);
  return toolError("internal", "Something went wrong on our side");
}

async function callTool(params: Record<string, unknown> | undefined, ctx: ToolContext) {
  const name = typeof params?.name === "string" ? params.name : "";
  const tool = findTool(name);
  if (!tool) return toolError("unknown_tool", `No tool named "${name}"`);
  if (tool.scope === "act" && ctx.principal.scope !== "act") {
    return toolError("insufficient_scope", "This token is read-only. Create an 'act' token in Dossierly to let an agent add tasks or deadlines.");
  }
  const parsed = tool.input.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return toolError("invalid_arguments", `Invalid arguments: ${i.path.join(".") || "input"} ${i.message}`);
  }
  if (tool.usesModel) {
    const rl = await rateLimit(ctx.env, ctx.principal.accountId, `mcp-model:${ctx.principal.tokenId}`, 30, 3600);
    if (!rl.ok) return toolError("rate_limited", `Too many model-backed calls. Retry in ${rl.retryAfterSec}s.`);
  }
  try {
    return toolResult(await tool.run(parsed.data as never, ctx));
  } catch (e) {
    return mapToolFailure(e);
  }
}

function listTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: `${t.description} [scope: ${t.scope}]`,
    inputSchema: z.toJSONSchema(t.input, { io: "input", unrepresentable: "any" }),
    annotations: { readOnlyHint: t.scope === "read" && t.name !== "read_letter", destructiveHint: false, openWorldHint: !!t.usesModel },
  }));
}

/** Handles one JSON-RPC message; returns null for notifications and responses (no reply). */
export async function handleMessage(raw: unknown, ctx: ToolContext): Promise<object | null> {
  const m = messageSchema.safeParse(raw);
  if (!m.success) return rpcError(null, E.request, "Invalid JSON-RPC message");
  const { id, method, params } = m.data;
  if (!method) return null; // a response from the client: nothing to answer
  if (id === undefined) return null; // notification (e.g. notifications/initialized)
  switch (method) {
    case "initialize": {
      const asked = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      const version = (SUPPORTED_VERSIONS as readonly string[]).includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return rpcResult(id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: listTools() });
    case "tools/call":
      return rpcResult(id, await callTool(params, ctx));
    default:
      return rpcError(id, E.method, `Method not found: ${method}`);
  }
}

export { E as RPC_CODES, rpcError };
