/*
 * Reproduces the latency and cost numbers in our docs from the D1 `runs` table (read-only SELECT).
 * D1 (SQLite) has no percentile function, so raw rows are fetched and p50/p95/means are computed here.
 * No user_id or other personal data is selected. Only cloud runs (ran_on = 'cloud') are counted.
 * Usage: npx tsx scripts/latency-report.ts [--db dossierly-meta-preview-db] [--since 2026-11-01]
 */
import { execFileSync } from "node:child_process";
import { z } from "zod";

const Args = z.object({
  db: z.string().regex(/^[A-Za-z0-9_-]+$/).default("dossierly-meta-preview-db"),
  since: z.string().optional().refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), "invalid ISO date"),
});

const Row = z.object({
  feature: z.string(),
  model: z.string().nullable(),
  ran_on: z.string(),
  ms: z.number(),
  tokens_in: z.number().nullable(),
  tokens_out: z.number().nullable(),
  cost_micro: z.number().nullable(),
  ts: z.number(),
});
type Row = z.infer<typeof Row>;

function parseArgs() {
  const raw: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || argv[i + 1] === undefined) throw new Error(`bad argument: ${argv[i]}`);
    raw[argv[i].slice(2)] = argv[i + 1];
  }
  return Args.strict().parse(raw);
}

function fetchRows(db: string, since?: string): Row[] {
  const sinceMs = since ? Date.parse(since) : 0;
  const sql = `SELECT feature, model, ran_on, ms, tokens_in, tokens_out, cost_micro, ts FROM runs WHERE ran_on = 'cloud' AND ts >= ${Math.trunc(sinceMs)}`;
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", db, "--remote", "--config", "wrangler.jsonc", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
  );
  const parsed: unknown = JSON.parse(out.slice(out.indexOf("[")));
  const results = z.array(z.object({ results: z.array(z.unknown()) })).parse(parsed)[0]?.results ?? [];
  return results.map((r) => Row.parse(r));
}

const pct = (sorted: number[], p: number) => {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1)); // nearest-rank
  return sorted[idx];
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const myt = (ms: number) => new Date(ms + 8 * 3600_000).toISOString().replace("T", " ").slice(0, 19) + " MYT";

function main() {
  const { db, since } = parseArgs();
  const rows = fetchRows(db, since);
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.feature}\u0000${r.model ?? "(none)"}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const lines = rows.length
    ? [...groups.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .map(([k, g]) => {
          const [feature, model] = k.split("\u0000");
          const ms = g.map((r) => r.ms).sort((a, b) => a - b);
          const cost = mean(g.map((r) => (r.cost_micro ?? 0) / 1e6));
          return `| ${feature} | ${model} | ${g.length} | ${pct(ms, 0.5)} | ${pct(ms, 0.95)} | ${Math.round(mean(ms))} | ${Math.round(mean(g.map((r) => r.tokens_in ?? 0)))} | ${Math.round(mean(g.map((r) => r.tokens_out ?? 0)))} | $${cost.toFixed(4)} |`;
        })
    : [];
  const ts = rows.map((r) => r.ts);
  const range = rows.length ? `${myt(Math.min(...ts))} to ${myt(Math.max(...ts))}` : "no rows";
  const head = `DB: ${db} | cloud runs: ${rows.length} | range: ${range}${since ? ` | since ${since}` : ""}`;
  const table = [
    "| feature | model | n | p50 ms | p95 ms | mean ms | mean tokens in | mean tokens out | mean cost USD |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...lines,
  ];
  process.stdout.write(`${head}\n\n${table.join("\n")}\n`);
}

try {
  main();
} catch (e) {
  process.stderr.write(`latency-report failed: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
}
