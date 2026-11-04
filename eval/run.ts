/*
 * Muse evaluation harness. Runs the product's own Look pipeline (readLook: Spark grounding call + reading call,
 * then SAM box refinement via the product's outlineFor) over eval/data, once per model configuration.
 * Usage: MODEL_API_KEY=... npx tsx eval/run.ts [--configs a,b] [--limit N] [--variants clean,photoA,photoB] [--budget 15] [--tag name]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readLook } from "../src/lib/look/read";
import { outlineFor, parseSamMasks } from "../src/lib/look/outline";
import { samSegment } from "../src/lib/model/meta";
import { ModelError } from "../src/lib/model/types";
import type { Env } from "../src/lib/server/env";
import { aggregate, type JobResult } from "./lib/aggregate";
import { recordingClient, SAM_USD, usd, type CallRecord } from "./lib/client";
import { scoreRead, type Truth } from "./lib/score";
import { iou } from "./lib/stats";

const here = dirname(fileURLToPath(import.meta.url));
type Effort = "minimal" | "low" | "medium" | "high";
const CONFIGS: Array<{ id: string; model: string; effort: Effort }> = [
  { id: "spark-1.1-low", model: "muse-spark-1.1", effort: "low" },
  { id: "spark-1.2-low", model: "muse-spark-1.2", effort: "low" },
  { id: "spark-1.2-minimal", model: "muse-spark-1.2", effort: "minimal" },
  { id: "spark-1.3-low", model: "muse-spark-1.3", effort: "low" },
  { id: "spark-1.3-high", model: "muse-spark-1.3", effort: "high" },
  { id: "wonder-1.0-low", model: "muse-wonder-1.0", effort: "low" },
];

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const KEY = process.env.MODEL_API_KEY ?? "";
if (!KEY) { process.stderr.write("MODEL_API_KEY is not set\n"); process.exit(2); }
const BUDGET = Number(arg("budget") ?? 15);
const HEADROOM = 0.8; // stop starting jobs this far below the hard cap, so in-flight work cannot cross it
const SAM_ON = arg("sam") !== "off";
const variants = (arg("variants") ?? "clean,photoA,photoB").split(",");
const limit = Number(arg("limit") ?? 1e9);
const wanted = (arg("configs") ?? CONFIGS.map((c) => c.id).join(",")).split(",");
const tag = arg("tag") ?? "full";
let spent = 0;
const log = (s: string) => process.stdout.write(`${s}\n`);

const stubDb = { prepare: () => { const s = { bind: () => s, run: async () => ({ meta: { changes: 1 } }), first: async () => null, all: async () => ({ results: [] }) }; return s; }, batch: async () => [] };
const envFor = (model: string) => ({ DB: stubDb, MODEL_API_KEY: KEY, MODEL_VISION_MODEL: model, APP_ENV: "eval", MODEL_DAILY_USD_CAP: "1000" }) as unknown as Env;

const labels = JSON.parse(readFileSync(join(here, "data/labels.json"), "utf8")) as Array<Truth & { images: Array<{ file: string; variant: string; size: [number, number]; box: number[] }> }>;

async function sam(image: string, size: { w: number; h: number }, box: [number, number, number, number], model: string) {
  for (let a = 1; a <= 4; a++) {
    try {
      const out = await samSegment({ image, boxes: [box], size }, { env: envFor(model), timeoutMs: 45_000 });
      const rec = (await parseSamMasks(out.raw)).get("1");
      return { outline: outlineFor({ id: "i1", box }, rec, size), source: rec ? "sam" : "fallback" };
    } catch (e) {
      if (!(e instanceof ModelError) || e.code === "bad_request" || a === 4) return { outline: outlineFor({ id: "i1", box }, undefined, size), source: "error" };
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (a - 1)));
    }
  }
  throw new Error("unreachable");
}

async function job(cfg: (typeof CONFIGS)[number], lab: (typeof labels)[number], img: (typeof labels)[number]["images"][number]): Promise<JobResult> {
  const mime = img.file.endsWith(".png") ? "image/png" : "image/jpeg";
  const image = `data:${mime};base64,${readFileSync(join(here, "data/images", img.file)).toString("base64")}`;
  const [w, h] = img.size;
  const calls: CallRecord[] = [];
  const base = { config: cfg.id, id: lab.id, type: lab.type, variant: img.variant };
  const t0 = Date.now();
  let read = null as Awaited<ReturnType<typeof readLook>> | null;
  let error: string | undefined;
  try {
    read = await readLook(envFor(cfg.model), null, { image, width: w, height: h }, "", { effort: cfg.effort as "low", client: recordingClient({ MODEL_API_KEY: KEY }, (c) => calls.push(c)) });
  } catch (e) {
    error = e instanceof Error ? `${e.name}:${e.message}`.slice(0, 160) : "error";
  }
  const readMs = Date.now() - t0;
  const modelUsd = calls.reduce((a, c) => a + usd(c.model, c.usage), 0);
  spent += modelUsd;
  const truthBox = lab.deadlineKind !== "none" ? img.box : null;
  const sparkBox = read?.items.find((i) => i.role === "deadline")?.box ?? null;
  let samBox: number[] | null = null, samSource: string | null = null, samMs: number | null = null, samUsd = 0;
  if (SAM_ON && sparkBox && truthBox) {
    const t1 = Date.now();
    const s = await sam(image, { w, h }, sparkBox, cfg.model);
    samMs = Date.now() - t1; samUsd = SAM_USD; spent += SAM_USD;
    samBox = s.outline.box; samSource = s.source;
  }
  return {
    ...base, ok: !!read, error, scores: scoreRead(lab, read), spark: sparkBox, sam: samBox, samSource, truthBox,
    iouSpark: truthBox ? (sparkBox ? iou(sparkBox, truthBox) : 0) : null,
    iouSam: truthBox && SAM_ON ? (samBox ? iou(samBox, truthBox) : sparkBox ? null : 0) : null,
    readMs, groundMs: Math.max(0, ...calls.filter((c) => c.kind === "ground").map((c) => c.ms)), samMs,
    costUsd: modelUsd, samUsd, tokensIn: calls.reduce((a, c) => a + c.usage.tokensIn, 0), tokensOut: calls.reduce((a, c) => a + c.usage.tokensOut, 0),
    retries: calls.filter((c) => c.attempts > 1).length, ...(read ? { read } : {}),
  } as JobResult;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync(join(here, "results"), { recursive: true });
  const out = join(here, "results", `${stamp}${tag === "full" ? "" : `-${tag}`}.json`);
  const configs = CONFIGS.filter((c) => wanted.includes(c.id));
  const items = labels.slice(0, limit).flatMap((l) => l.images.filter((i) => variants.includes(i.variant)).map((i) => [l, i] as const));
  const all: Record<string, JobResult[]> = {};
  for (const cfg of configs) {
    const res: JobResult[] = [];
    all[cfg.id] = res;
    await pool([...items], 4, async ([l, i]) => {
      if (spent >= BUDGET - HEADROOM) { log(`budget stop before ${cfg.id} ${l.id}/${i.variant}`); return; }
      const r = await job(cfg, l, i);
      res.push(r);
      log(`${cfg.id} ${l.id}/${i.variant} ok=${r.ok} dl=${r.scores.deadlineCorrect} iou=${r.iouSpark?.toFixed(2) ?? "-"}/${r.iouSam?.toFixed(2) ?? "-"} ${r.readMs}ms $${(r.costUsd + r.samUsd).toFixed(4)} total=$${spent.toFixed(2)}${r.error ? ` ERR ${r.error}` : ""}`);
    });
    const summary = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, aggregate(v)]));
    writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), budgetUsd: BUDGET, spentUsd: Number(spent.toFixed(4)), datasetLetters: new Set(items.map(([l]) => l.id)).size, images: items.length, summary, jobs: all }, null, 1));
    log(`checkpoint ${out} spent=$${spent.toFixed(3)}`);
  }
}
void main();
