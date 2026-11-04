/* Static Poland hub content, bundled at build time from hub/poland/*.json. */
import coverageJson from "../../../hub/poland/coverage.json";
import sourcesJson from "../../../hub/poland/sources.json";
import seedChangesJson from "../../../hub/poland/seed-changes.json";
import pagesJson from "../../../hub/poland/pages.json";
import phrasesJson from "../../../hub/phrases/pl.json";

export interface HubSource {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  kind: string;
  language?: string;
  watch: boolean;
  topics: string[];
  verified: boolean;
  note?: string;
}
export interface PhraseSituation {
  id: string;
  title: Record<string, string>;
  phrases: Array<Record<string, string>>;
}
export interface SeedChange {
  id: string;
  title: string;
  summary: string;
  url: string;
  detectedAt: string;
  sample?: boolean;
}

export const COUNTRY = "pl";
export const sources = (sourcesJson as unknown as { sources: HubSource[] }).sources;
export const coverage = coverageJson as unknown as Record<string, unknown> & {
  offices: unknown[];
  letterTypes: Array<Record<string, unknown>>;
  fees: Array<Record<string, unknown>>;
  notices: Array<Record<string, unknown>>;
  procedures: Array<Record<string, unknown>>;
  languages: string[];
};
export const phrases = (phrasesJson as unknown as { situations: PhraseSituation[] }).situations;
export const seedChanges = (seedChangesJson as unknown as { changes: SeedChange[] }).changes;
/** Nightly watch set: at most 5 verified, non-statute pages to keep each nightly run small. */
const WATCH_ORDER = ["wsc-komunikaty", "wsc-oplaty", "udsc-info-mos", "udsc-oplaty", "wsc-proc-praca", "udsc-mos-qa", "govpl-edoreczenia"];
export const watchedSources = () =>
  sources
    .filter((s) => s.watch && s.verified && s.kind !== "legal")
    .sort((a, b) => (WATCH_ORDER.indexOf(a.id) + 99) % 99 - (WATCH_ORDER.indexOf(b.id) + 99) % 99)
    .slice(0, 5);
/** Page text captured by scripts/seed-hub.ts from the real sources; the retrieval fallback when D1 and KV are cold. */
export const bundledPages = (pagesJson as unknown as { pages: Array<{ url: string; fetchedAt: string; text: string }> }).pages;
