/* Renders markdown tables from one or more result files: npx tsx eval/report.ts eval/results/a.json [b.json ...] */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
const merged: Record<string, any> = {};
let spent = 0;
for (const f of files) {
  const r = JSON.parse(readFileSync(f, "utf8"));
  spent += r.spentUsd;
  Object.assign(merged, r.summary);
}
const p = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
const f2 = (x: number) => x.toFixed(2);
const s = (x: number) => `${(x / 1000).toFixed(1)}s`;
const ids = Object.keys(merged);
const row = (cells: string[]) => `| ${cells.join(" | ")} |`;
const table = (head: string[], rows: string[][]) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const sel = (scope: "all" | "clean" | "photo") => ids.map((i) => [i, merged[i][scope]] as const);

console.log("### Extraction (all images)\n");
console.log(table(["config", "n", "case no.", "letter date", "period", "type", "docs F1", "deadline correct", "appointment exact"],
  sel("all").map(([i, b]) => [i, String(b.n), p(b.caseNumber), p(b.letterDate), p(b.periodAmountUnit), p(b.letterType), f2(b.docsF1), p(b.deadlineCorrect), p(b.appointmentExact)])));
console.log("\n### Grounding of the deadline sentence\n");
console.log(table(["config", "box found", "Spark IoU", "SAM IoU", "Spark IoU>=0.5", "SAM IoU>=0.5", "Spark IoU>=0.75", "SAM IoU>=0.75"],
  sel("all").map(([i, b]) => [i, p(b.boxFound), f2(b.iouSparkMean), f2(b.iouSamMean), p(b.iouSparkGe50), p(b.iouSamGe50), p(b.iouSparkGe75), p(b.iouSamGe75)])));
console.log("\n### Clean render vs photo-like (deadline correct / Spark IoU / SAM IoU)\n");
console.log(table(["config", "clean", "photo"], ids.map((i) => [i, ...(["clean", "photo"] as const).map((k) => { const b = merged[i][k]; return `${p(b.deadlineCorrect)} / ${f2(b.iouSparkMean)} / ${f2(b.iouSamMean)}`; })])));
console.log("\n### Latency and cost\n");
console.log(table(["config", "look p50", "look p95", "SAM p50", "tokens in/out", "cost per letter (with SAM)", "total spend"],
  sel("all").map(([i, b]) => [i, s(b.latencyReadP50), s(b.latencyReadP95), s(b.latencySamP50), `${Math.round(b.tokensInMean)} / ${Math.round(b.tokensOutMean)}`, `$${b.costPerLetterUsd.toFixed(4)}`, `$${b.totalUsd.toFixed(2)}`])));
console.log("\n### By letter type (deadline correct / docs F1 / Spark IoU; appointments: exact date+time)\n");
const types = [...new Set(ids.flatMap((i) => Object.keys(merged[i].byType)))];
console.log(table(["config", ...types], ids.map((i) => [i, ...types.map((t) => { const b = merged[i].byType[t]; return b ? `${t === "appointment" ? `appt ${p(b.appointmentExact)}` : `${p(b.deadlineCorrect)} / ${b.type === 0 ? "" : ""}${t === "decision" ? "n/a" : f2(b.docsF1)} / ${t === "appointment" ? "n/a" : f2(b.iouSparkMean)}`} (n=${b.n})` : "-"; })])));
console.log(`\nSpend across the result files: $${spent.toFixed(2)}`);
