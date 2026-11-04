/*
 * Prepare pipeline: source selection -> cached/live page text -> chunking -> keyword rank -> passages.
 * No model writes text here; the agent (sandbox) or the cloud fallback turns passages into a checklist.
 */
import { HUB_LIMITS } from "../config";
import type { Language } from "../schemas";
import type { Env } from "../server/env";
import { COUNTRY, bundledPages, coverage, phrases, seedChanges, sources, type HubSource } from "./data";
import { lexicalRank, type Passage, type Ranked } from "./rank";
import { latestSnapshot, listChanges, type HubChange } from "./store";
import { cachedExtract, groundedSearch, type Origin } from "./search";
import { chunkText } from "./util";

export interface HubContext {
  query: string;
  topics: string[];
  passages: Array<{ url: string; title: string; text: string; score: number }>;
  changes: HubChange[];
  phrases: Array<{ local: string; user: string }>;
  retrieval: { embeddings: "keyword"; pages: number; origin: Origin | "snapshot" | "none"; sources: Array<{ url: string; fetchedAt: string | null; kind: "snapshot" | "bundled" | "extract" }> };
}

const TOPIC_WORDS: Array<[string, RegExp]> = [
  ["fingerprints", /finger|odcisk|biometr|karta pobytu|residence card|appointment/i],
  ["wezwanie", /wezwani|letter|deficien|braki|uzupełni/i],
  ["fees", /fee|opłat|stamp|zł|pay/i],
  ["doctor", /doctor|lekarz|clinic|hospital|nfz|przychodni/i],
  ["bank", /bank|account|konto/i],
];

export function topicsFor(purpose: string): string[] {
  const t = TOPIC_WORDS.filter(([, re]) => re.test(purpose)).map(([k]) => k);
  return t.length ? t : ["fingerprints"];
}

function pickSources(topics: string[]): HubSource[] {
  const hit = sources.filter((s) => s.topics.some((t) => topics.includes(t)));
  const always = sources.filter((s) => s.watch && (s.kind === "komunikat" || s.kind === "fees"));
  return [...new Map([...hit, ...always].map((s) => [s.url, s])).values()].slice(0, 6);
}

function coveragePassages(topics: string[]): Passage[] {
  const out: Passage[] = [];
  const src = (id: unknown) => sources.find((s) => s.id === id);
  const add = (id: string, sourceId: unknown, text: string) => {
    const s = src(sourceId);
    if (s) out.push({ id, url: s.url, title: s.title, text });
  };
  for (const f of coverage.fees ?? []) add(`fee:${f.id}`, f.sourceId, `Fee ${f.amountPln} zł: ${f.what}. ${f.quote ?? ""}`);
  for (const n of coverage.notices ?? []) add(`notice:${n.id}`, n.sourceId, `${n.date}: ${n.title}. ${n.summary} ${n.quote ?? ""}`);
  if (topics.includes("wezwanie")) {
    for (const l of coverage.letterTypes ?? []) {
      const rule = l.deadlineRule as { sourceId?: string; days?: number | null; basis?: string; quote?: string } | undefined;
      add(`letter:${l.id}`, rule?.sourceId, `${l.polishName} (${l.englishName}): ${l.whatItMeans} Deadline: ${rule?.days ?? "not stated"} days. ${rule?.basis ?? ""} ${rule?.quote ?? ""}`);
    }
  }
  return out;
}

function phrasesFor(topics: string[], language: Language) {
  const want = phrases.filter((p) => topics.some((t) => p.id.includes(t) || (t === "fingerprints" && /office|urz/i.test(p.id)))) ;
  const pool = (want.length ? want : phrases).flatMap((p) => p.phrases);
  return pool.slice(0, 6).map((p) => ({ local: p.pl, user: p[language] ?? p.en }));
}

/** Merge database changes with the bundled seed (deduplicated by id), newest first. */
export async function mergedChanges(env: Env, limit = 20): Promise<HubChange[]> {
  let rows: HubChange[] = [];
  try {
    rows = await listChanges(env, COUNTRY, limit);
  } catch {
    rows = [];
  }
  const ids = new Set(rows.map((r) => r.id));
  const seed = seedChanges.filter((c) => !ids.has(c.id) && !c.sample).map((c) => ({ ...c, sample: false }));
  return [...rows.filter((r) => !r.sample), ...seed].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, limit);
}

export async function buildHubContext(
  env: Env,
  i: { userId: string; appointment: { office: string; purpose: string }; language: Language },
): Promise<HubContext> {
  const topics = topicsFor(i.appointment.purpose);
  const query = `${i.appointment.purpose} ${i.appointment.office} ${topics.join(" ")} karta pobytu`;
  const picked = pickSources(topics);
  const pages: Array<{ source: HubSource; text: string }> = [];
  const provenance: HubContext["retrieval"]["sources"] = [];
  const missing: HubSource[] = [];
  for (const s of picked) {
    const snap = await latestSnapshot(env, COUNTRY, s.url).catch(() => null);
    const bundled = bundledPages.find((b) => b.url === s.url);
    if (snap?.content) { pages.push({ source: s, text: snap.content }); provenance.push({ url: s.url, fetchedAt: new Date(snap.fetched_at).toISOString(), kind: "snapshot" }); }
    else if (bundled) { pages.push({ source: s, text: bundled.text }); provenance.push({ url: s.url, fetchedAt: bundled.fetchedAt, kind: "bundled" }); }
    else missing.push(s);
  }
  let origin: HubContext["retrieval"]["origin"] = pages.length ? "snapshot" : "none";
  if (!pages.length && missing.length) {
    // Nothing stored or bundled: read-through cache of the official pages themselves.
    const ex = await cachedExtract(env, missing.map((m) => m.url), { userId: i.userId, demo: true });
    origin = ex.origin;
    for (const p of ex.pages) {
      const source = missing.find((m) => m.url === p.url) ?? missing.find((m) => p.url.startsWith(m.url));
      if (source) { pages.push({ source, text: p.text }); provenance.push({ url: source.url, fetchedAt: null, kind: "extract" }); }
    }
  }
  const search = pages.length ? null : await groundedSearch(env, query, { userId: i.userId, demo: true });
  if (search?.passages.length) origin = "live";
  const passages: Passage[] = [
    ...pages.flatMap(({ source, text }) =>
      chunkText(text, HUB_LIMITS.chunkChars).map((t, n) => ({ id: `${source.id}#${n}`, url: source.url, title: source.title, text: t })),
    ),
    ...coveragePassages(topics),
    ...(search?.passages ?? []).map((p, n) => ({ id: `search#${n}`, url: p.url, title: p.title, text: p.text })),
  ];
  const top: Ranked[] = lexicalRank(query, passages, HUB_LIMITS.topK);
  return {
    query,
    topics,
    passages: top.map((p) => ({ url: p.url, title: p.title, text: p.text, score: Number(p.score.toFixed(4)) })),
    changes: (await mergedChanges(env, 5)),
    phrases: phrasesFor(topics, i.language),
    retrieval: { embeddings: "keyword", pages: pages.length, origin, sources: provenance },
  };
}

/** Pre-reads the usual prepare topics so the first user request is served from the KV cache. */
export async function warmHub(env: Env): Promise<void> {
  for (const purpose of ["Residence card fingerprints", "Letter wezwanie documents"]) {
    await buildHubContext(env, { userId: "warm", appointment: { office: "Mazowiecki Urząd Wojewódzki w Warszawie", purpose }, language: "en" }).catch(() => undefined);
  }
}
