/*
 * Nightly source watcher (exported for builder A's NightlyWatch Workflow).
 * For each watched source: extract the page live, hash the content, compare with the latest
 * hub_snapshots row, and when it differs let the draft model summarise what changed into
 * hub_changes. First sight of a page has nothing to diff against: a static page is just baselined, and an
 * announcements listing (kind "komunikat", newest first) reports its latest items, as they appear on the page.
 */
import { Masker } from "../mask";
import { runModel } from "../model";
import type { ChatClient } from "../model/types";
import { HubSummaryOut } from "../features/outputs";
import { DATA_RULE, JSON_ONLY, NO_ADVICE } from "../features/prompts";
import type { Env } from "../server/env";
import { COUNTRY, coverage, sources, watchedSources } from "./data";
import { warmHub } from "./pipeline";
import { insertChange, insertSnapshot, latestSnapshot } from "./store";
import { liveExtract, type Page } from "./search";
import { sha256Hex } from "../server/util";

export interface WatchReport {
  checked: number;
  unchanged: number;
  changed: number;
  newChanges: Array<{ url: string; title: string; summary: string }>;
}

const MAX_CHARS = 14_000;
const lines = (t: string) => t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 3);

export function diffLines(oldText: string, newText: string): { added: string[]; removed: string[] } {
  const o = new Set(lines(oldText));
  const n = new Set(lines(newText));
  return { added: [...n].filter((l) => !o.has(l)), removed: [...o].filter((l) => !n.has(l)) };
}

const SYSTEM = `You monitor official Polish immigration web pages for a foreigner's caseworker. You are told what changed on a page (or, on first sight, shown the page). Report only substantive changes: new announcements (komunikaty), changed fees, deadlines, procedures, opening hours or required documents. Ignore menus, counters, cookie text and layout. ${NO_ADVICE} ${DATA_RULE} ${JSON_ONLY}
Schema: {"changes": [{"title": string (max 12 words, plain English), "summary": string (one or two sentences in English saying what is new or different; quote numbers and dates exactly), "date": string|null (the publication date printed next to the item as YYYY-MM-DD; null if none is printed)}]}
Return {"changes": []} when nothing substantive changed. Use the page's own terms (for example "certificate (zaświadczenie)", "stamp in the passport") and add nothing the text does not say. Never invent a date or number that is not in the text.`;

async function summarise(env: Env, input: string, today: string, client?: ChatClient) {
  const out = await runModel(
    { env, userId: null, client },
    {
      task: "hub_summary",
      system: SYSTEM,
      context: `Today: ${today}`,
      input,
      schema: HubSummaryOut,
      maxTokens: 3000,
      masker: new Masker(),
      replay: () => ({ changes: [] }),
    },
  );
  return out;
}

/** `pages` lets a caller supply already-fetched text (offline seeding, tests) instead of a live fetch. */
const words = (s: string) => new Set(s.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []);

/** The page extract carries no dates; the verified notices in coverage.json (read from the HTML listing) supply them. */
function withListedDate(title: string, summary: string, printed: string | null): string {
  const date =
    printed ??
    (coverage.notices as Array<{ date: string; title: string }>).find((n) => {
      const a = words(`${title} ${summary}`);
      return [...words(n.title)].filter((w) => a.has(w)).length >= 3;
    })?.date;
  return date ? `${summary} (Listed ${date} on the source page.)` : summary;
}

export async function runNightlyWatch(env: Env, opts: { urls?: string[]; pages?: Page[]; client?: ChatClient } = {}): Promise<WatchReport> {
  const today = new Date().toISOString().slice(0, 10);
  const urls = opts.urls ?? watchedSources().map((s) => s.url);
  const pages = opts.pages ?? (await liveExtract(env, urls));
  const report: WatchReport = { checked: pages.length, unchanged: 0, changed: 0, newChanges: [] };
  for (const page of pages) {
    const hash = await sha256Hex(page.text);
    const prev = await latestSnapshot(env, COUNTRY, page.url);
    if (prev?.content_hash === hash) {
      report.unchanged++;
      continue;
    }
    const snap = await insertSnapshot(env, COUNTRY, page.url, page.text);
    let input: string;
    if (prev?.content) {
      const d = diffLines(prev.content, page.text);
      if (!d.added.length && !d.removed.length) continue;
      input = `PAGE: ${page.url}\nADDED LINES:\n${d.added.join("\n").slice(0, 8000)}\nREMOVED LINES:\n${d.removed.join("\n").slice(0, 3000)}`;
    } else {
      // Static pages are only baselined on first sight; announcement listings are read for their latest items.
      if (sources.find((x) => x.url === page.url)?.kind !== "komunikat") continue;
      input = `PAGE: ${page.url}\nFIRST SIGHT. This page lists announcements newest first and the extract carries no dates. Report only the first 3 items in page order, as "latest announcements".\nPAGE TEXT:\n${page.text.slice(0, MAX_CHARS)}`;
    }
    report.changed++;
    const out = await summarise(env, input, today, opts.client);
    for (const c of out.data.changes) {
      const summary = withListedDate(c.title, c.summary, c.date);
      if (await insertChange(env, COUNTRY, { url: page.url, title: c.title, summary, snapshotId: snap.id })) {
        report.newChanges.push({ url: page.url, title: c.title, summary });
      }
    }
  }
  if (report.changed) await warmHub(env);
  return report;
}
