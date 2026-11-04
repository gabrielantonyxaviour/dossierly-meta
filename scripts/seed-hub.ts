/* Runs the nightly watch once against the real sources (plain page fetches, plus draft-role model calls that spend a few cents)
   and writes what it found into the repo, so the demo's detected changes are real and retrieval works with a cold cache:
     hub/poland/seed-changes.json  detected changes
     hub/poland/pages.json         page text of the watched sources (truncated)
   Run: node --env-file=.env.local --import tsx scripts/seed-hub.ts [--offline] [url ...]
   --offline re-reads hub/poland/pages.json instead of fetching the pages (no page requests). No URLs = every watched source. */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { watchedSources } from "../src/lib/hub/data";
import { runNightlyWatch } from "../src/lib/hub/watch";
import { freshLocalEnv } from "../src/lib/server/local";

const out = (s: string) => process.stdout.write(`${s}\n`);

async function main() {
  const env = freshLocalEnv({
    MODEL_API_KEY: process.env.MODEL_API_KEY ?? "",
  });
  const args = process.argv.slice(2);
  const offline = args.includes("--offline");
  const urls = args.filter((a) => !a.startsWith("--"));
  const pages = offline
    ? (JSON.parse(readFileSync(join(process.cwd(), "hub", "poland", "pages.json"), "utf8")) as { pages: Array<{ url: string; text: string }> }).pages.map((p) => ({ url: p.url, text: p.text }))
    : undefined;
  const report = await runNightlyWatch(env, { ...(urls.length ? { urls } : {}), ...(pages ? { pages } : {}) });
  out(`checked ${report.checked}, changed ${report.changed}, new changes ${report.newChanges.length}`);
  for (const c of report.newChanges) out(`  - ${c.title}\n    ${c.summary}\n    ${c.url}`);

  const changes = await env.DB.prepare("SELECT id, source_url, title, summary, detected_at FROM hub_changes ORDER BY detected_at DESC").all<{
    id: string; source_url: string; title: string; summary: string; detected_at: number;
  }>();
  const snaps = await env.DB.prepare("SELECT source_url, content, fetched_at FROM hub_snapshots").all<{ source_url: string; content: string; fetched_at: number }>();
  const root = join(process.cwd(), "hub", "poland");
  writeFileSync(
    join(root, "seed-changes.json"),
    JSON.stringify({ changes: changes.results.map((c) => ({ id: c.id, title: c.title, summary: c.summary, url: c.source_url, detectedAt: new Date(c.detected_at).toISOString(), sample: false })) }, null, 2) + "\n",
  );
  writeFileSync(
    join(root, "pages.json"),
    JSON.stringify({ pages: snaps.results.map((s) => ({ url: s.source_url, fetchedAt: new Date(s.fetched_at).toISOString(), text: s.content.slice(0, 20_000) })) }, null, 1) + "\n",
  );
  out(`wrote ${changes.results.length} changes and ${snaps.results.length} pages; watched sources: ${watchedSources().length}`);
}
void main();
