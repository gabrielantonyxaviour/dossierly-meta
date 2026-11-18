/*
 * Grounded web search. For real-user content (origin "user", the default) the search runs on Claude with Anthropic's
 * server-side web search tool, restricted to official Polish domains; demo/eval content keeps Meta's web_search.
 * The result has one shape for both: text, citations with URL, title and character range, search count and usage.
 * The Meta gate is untouched: resolveRole("search") throws provider_blocked if config ever points user content at Meta.
 */
import { ANTHROPIC_SEARCH_USD_PER_CALL, SEARCH_ALLOWED_DOMAINS, SEARCH_MAX_USES, SEARCH_TOOL_TYPE } from "../config";
import { anthropicPost, thinkingParams, usageOf, worstCase } from "./anthropic";
import { metaWebSearch, type Citation, type SearchArgs, type SearchResult } from "./meta";
import type { MetaOpts } from "./net";
import { resolveRole, type RoleConfig } from "./roles";
import { ModelError } from "./types";

type Cite = { type?: string; url?: string; title?: string | null };
type Block = {
  type?: string; text?: string; citations?: Cite[] | null; content?: unknown;
};
type Reply = { content?: Block[]; stop_reason?: string; usage?: Parameters<typeof usageOf>[0] & { server_tool_use?: { web_search_requests?: number } } };

const MAX_CONTINUATIONS = 2;

function envString(env: unknown, key: string): string {
  const v = (env as Record<string, unknown> | undefined)?.[key];
  const p = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return (typeof v === "string" && v.trim()) || (typeof p === "string" && p.trim()) || "";
}

/** The tool definition sent to the API: allowed_domains and max_uses are always present. */
export function searchTool(env?: unknown): Record<string, unknown> {
  const type = envString(env, "SEARCH_TOOL_TYPE") || SEARCH_TOOL_TYPE;
  const uses = Number(envString(env, "SEARCH_MAX_USES")) || SEARCH_MAX_USES;
  return { type, name: "web_search", max_uses: uses, allowed_domains: SEARCH_ALLOWED_DOMAINS };
}

/** Anthropic reply blocks to the shared shape. Each cited text block becomes one citation range in the joined text. */
export function normaliseSearchReply(blocks: Block[]): { text: string; citations: Citation[]; searches: number; failed: string | null } {
  let text = "";
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let searches = 0;
  let failed: string | null = null;
  for (const b of blocks) {
    if (b.type === "server_tool_use") searches++;
    else if (b.type === "web_search_tool_result") {
      const c = b.content as { type?: string; error_code?: string } | undefined;
      if (c && !Array.isArray(c) && c.type === "web_search_tool_result_error") failed = c.error_code ?? "unavailable";
    } else if (b.type === "text") {
      const start = text.length;
      text += b.text ?? "";
      for (const c of b.citations ?? []) {
        if (c.type !== "web_search_result_location" || !c.url) continue;
        const key = `${c.url}|${start}`;
        if (seen.has(key)) continue;
        seen.add(key);
        citations.push({ url: c.url, title: c.title ?? "", start, end: text.length });
      }
    }
  }
  return { text, citations, searches, failed };
}

async function anthropicWebSearch(args: SearchArgs, o: MetaOpts, cfg: RoleConfig): Promise<SearchResult> {
  const maxTokens = args.maxTokens ?? 2500;
  const messages: Array<{ role: string; content: unknown }> = [{ role: "user", content: args.query }];
  const blocks: Block[] = [];
  let usage = { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
  let requests = 0;
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const body: Record<string, unknown> = {
      model: cfg.model, max_tokens: maxTokens, messages, tools: [searchTool(o.env)], ...thinkingParams(cfg.model, cfg.effort),
    };
    if (args.system) body.system = args.system;
    const res = await anthropicPost(cfg, body, o);
    const json = (await res.json().catch(() => null)) as Reply | null;
    if (!json) throw new ModelError("The model service returned an error", "model_error");
    const u = usageOf(json.usage, () => worstCase(messages, maxTokens));
    usage = { tokensIn: usage.tokensIn + u.tokensIn, tokensOut: usage.tokensOut + u.tokensOut, cachedTokens: usage.cachedTokens + u.cachedTokens };
    requests += json.usage?.server_tool_use?.web_search_requests ?? 0;
    const got = json.content ?? [];
    blocks.push(...got);
    if (json.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: got });
  }
  const n = normaliseSearchReply(blocks);
  if (n.failed === "max_uses_exceeded") n.failed = null; // the answer so far is still usable
  if (n.failed && !n.text) throw new ModelError("The search service is briefly unavailable", "model_unavailable", 503, usage);
  return {
    text: n.text, citations: n.citations, searches: Math.max(requests, n.searches), usage, model: cfg.model,
    usdPerSearch: ANTHROPIC_SEARCH_USD_PER_CALL,
  };
}

/** Grounded search routed by config and content origin. User content never reaches Meta (gate.ts). */
export async function webSearch(args: SearchArgs, o: MetaOpts = {}): Promise<SearchResult> {
  const cfg = resolveRole("search", o.env, o.origin);
  return cfg.provider === "anthropic" ? anthropicWebSearch(args, o, cfg) : metaWebSearch(args, o);
}
