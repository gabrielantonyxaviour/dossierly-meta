/*
 * Official-page access for the hub. Pages are read with a plain fetch (verbatim text, so citations can be
 * checked word for word) and cached in KV; the Meta grounded web search (Responses API, web_search tool) covers a
 * cold hub with no stored or bundled pages. Both are budgeted and written to the ledger. Never call on page load.
 */
import { HUB_DOMAINS, HUB_LIMITS, SEARCH_USD_PER_CALL } from "../config";
import { Masker } from "../mask";
import { meterFixed } from "../model/meter";
import { webSearch, type Citation } from "../model/meta";
import { costUsd } from "../model/cost";
import type { Env } from "../server/env";
import { checkAndSpend } from "../server/budget";
import { recordLedger } from "../server/ledger";
import { normQuery, normUrl, shortHash } from "./util";

export interface Page {
  url: string;
  text: string;
}
export type Origin = "cache" | "live" | "budget" | "no_key";
export interface SearchPassage {
  url: string;
  title: string;
  text: string;
}

export interface CacheOpts {
  userId?: string | null;
  /** Demo-set entries never expire; everything else keeps for 7 days. */
  demo?: boolean;
}

const putCache = (env: Env, key: string, value: unknown, demo?: boolean) =>
  env.CACHE.put(key, typeof value === "string" ? value : JSON.stringify(value), demo ? undefined : { expirationTtl: HUB_LIMITS.kvTtlSeconds });

async function ledger(env: Env, userId: string | null, what: string, region: string, action: "allowed" | "denied", bytes: number, masked: number) {
  try {
    await recordLedger(env, { userId, kind: "egress", what, region, action, bytes, masked });
  } catch {
    /* bookkeeping must not fail the request */
  }
}

/** HTML to readable text: drop scripts, styles and tags, keep paragraph breaks. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>|<br\s*\/?>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

const HOST_OK = (u: string) => {
  try {
    const h = new URL(u).hostname;
    return HUB_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

async function fetchPage(url: string): Promise<string | null> {
  if (!HOST_OK(url)) return null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "DossierlyBot/1.0 (+official-page watch)", Accept: "text/html" } });
    if (!res.ok) return null;
    const text = htmlToText(await res.text());
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

/** Read-through cached page text for official URLs (KV, one entry per URL). */
export async function cachedExtract(env: Env, urls: string[], opts: CacheOpts = {}): Promise<{ pages: Page[]; origin: Origin }> {
  const pages: Page[] = [];
  let live = false;
  for (const u of urls) {
    const key = `page:${await shortHash(normUrl(u))}`;
    const hit = await env.CACHE.get(key);
    if (hit) {
      pages.push({ url: u, text: hit });
      continue;
    }
    const text = await fetchPage(u);
    await ledger(env, opts.userId ?? null, "official page fetch", new URL(u).hostname, text ? "allowed" : "denied", u.length, 0);
    if (!text) continue;
    live = true;
    pages.push({ url: u, text });
    await putCache(env, key, text, opts.demo);
  }
  return { pages, origin: live ? "live" : pages.length ? "cache" : "no_key" };
}

/** Always-live page reads for the nightly watch (no read-through cache). */
export async function liveExtract(_env: Env, urls: string[]): Promise<Page[]> {
  const out: Page[] = [];
  for (const u of urls) {
    const text = await fetchPage(u);
    if (text) out.push({ url: u, text });
  }
  return out;
}

const SEARCH_SYSTEM = `You search official Polish immigration sources (${HUB_DOMAINS.join(", ")}) for a foreigner's caseworker. Prefer those domains and answer only from the pages you found, quoting figures, deadlines and document names exactly. If the official pages do not answer, say so.`;

/**
 * Grounded web search on Meta Spark. The answer text is split into sentences; each sentence that carries a
 * citation becomes a passage tied to the cited official URL.
 */
export async function groundedSearch(
  env: Env,
  query: string,
  opts: CacheOpts = {},
): Promise<{ passages: SearchPassage[]; citations: Citation[]; origin: Origin }> {
  const masker = new Masker();
  const q = masker.mask(query);
  const key = `search:${await shortHash(normQuery(q))}`;
  const cached = await env.CACHE.get(key);
  if (cached) {
    const c = JSON.parse(cached) as { passages: SearchPassage[]; citations: Citation[] };
    return { ...c, origin: "cache" };
  }
  const userId = opts.userId ?? null;
  if (!(await checkAndSpend(env, "search_calls", 1, { userId: userId ?? undefined }))) {
    await ledger(env, userId, "grounded web search", "api.meta.ai", "denied", q.length, masker.count);
    return { passages: [], citations: [], origin: "budget" };
  }
  let result;
  try {
    result = await meterFixed(env, 0.02 + SEARCH_USD_PER_CALL, async () => {
      const r = await webSearch({ query: q, system: SEARCH_SYSTEM }, { env });
      return { value: r, actualUsd: costUsd(r.model, r.usage) + r.searches * SEARCH_USD_PER_CALL };
    });
  } catch (err) {
    if ((err as { code?: string }).code === "no_key") return { passages: [], citations: [], origin: "no_key" };
    return { passages: [], citations: [], origin: "budget" };
  }
  await ledger(env, userId, "grounded web search", "api.meta.ai", "allowed", q.length, masker.count);
  const official = result.citations.filter((c) => HOST_OK(c.url));
  const passages: SearchPassage[] = official.map((c) => ({
    url: c.url,
    title: c.title || new URL(c.url).hostname,
    text: sentenceAround(result.text, c.start, c.end),
  })).filter((p) => p.text.length > 20);
  if (passages.length) await putCache(env, key, { passages, citations: official }, opts.demo);
  return { passages, citations: official, origin: "live" };
}

function sentenceAround(text: string, start: number, end: number): string {
  const from = Math.max(text.lastIndexOf(". ", Math.max(0, start - 1)) + 1, 0);
  const next = text.indexOf(". ", Math.max(end, 0));
  return text.slice(from, next === -1 ? text.length : next + 1).trim();
}
