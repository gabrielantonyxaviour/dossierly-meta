/*
 * Anthropic Messages API with tool use, for the case-review tool loop (src/lib/strategist). The loop keeps its
 * messages in the OpenAI shape (assistant tool_calls, tool results); this maps them to content blocks and back.
 * An assistant turn carries its raw content blocks in `raw` so thinking blocks are echoed back unchanged, which the
 * API requires when thinking and tools are combined.
 */
import { anthropicPost, thinkingParams, usageOf, worstCase, type AMessage } from "./anthropic";
import type { MetaOpts } from "./net";
import type { RoleConfig } from "./roles";
import { ModelError } from "./types";
import type { Usage } from "./types";

export type ToolCallLike = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCallLike[]; raw?: unknown[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export function toAnthropicToolMessages(messages: ToolMessage[]): { system: string; messages: AMessage[] } {
  const system = messages.flatMap((m) => (m.role === "system" ? [m.content] : [])).join("\n\n");
  const out: AMessage[] = [];
  const push = (role: "user" | "assistant", blocks: Array<Record<string, unknown>>) => {
    const last = out[out.length - 1];
    if (last && last.role === role) (last.content as Array<Record<string, unknown>>).push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }]);
    else if (m.role !== "assistant") push("user", [{ type: "text", text: m.content }]);
    else if (m.raw?.length) push("assistant", m.raw as Array<Record<string, unknown>>);
    else {
      const blocks: Array<Record<string, unknown>> = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const t of m.tool_calls ?? []) {
        let input: unknown = {};
        try {
          input = JSON.parse(t.function.arguments || "{}");
        } catch {
          /* an unparseable argument string is sent as an empty input */
        }
        blocks.push({ type: "tool_use", id: t.id, name: t.function.name, input });
      }
      if (blocks.length) push("assistant", blocks);
    }
  }
  return { system, messages: out };
}

export interface ToolReply { content: string | null; toolCalls: ToolCallLike[]; usage: Usage; raw: unknown[] }

export async function anthropicToolChat(
  cfg: RoleConfig,
  req: { messages: ToolMessage[]; tools?: ToolSpec[]; json?: Record<string, unknown>; maxTokens: number },
  o: MetaOpts,
): Promise<ToolReply> {
  const { system, messages } = toAnthropicToolMessages(req.messages);
  const sys = req.json ? `${system}\n\nReply with exactly one JSON object and nothing else.\nThe object must match this JSON Schema:\n${JSON.stringify(req.json)}` : system;
  const body: Record<string, unknown> = { model: cfg.model, max_tokens: req.maxTokens, messages, ...thinkingParams(cfg.model, "high") };
  if (sys) body.system = sys;
  if (req.tools?.length) {
    body.tools = req.tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
    body.tool_choice = { type: "auto" };
  }
  const res = await anthropicPost(cfg, body, o);
  const json = (await res.json().catch(() => null)) as { content?: Array<Record<string, unknown>>; stop_reason?: string; usage?: Parameters<typeof usageOf>[0] } | null;
  if (!json) throw new ModelError("The model service returned an error", "model_error");
  const usage = usageOf(json.usage, () => worstCase(req.messages, req.maxTokens));
  const blocks = json.content ?? [];
  const text = blocks.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("");
  const toolCalls = blocks.filter((b) => b.type === "tool_use").map((b): ToolCallLike => ({ id: String(b.id), type: "function", function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) } }));
  if (json.stop_reason === "refusal" || (!text && !toolCalls.length)) throw new ModelError("Model returned an empty reply", "model_error", 502, usage);
  return { content: text || null, toolCalls, usage, raw: blocks };
}
