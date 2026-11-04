/*
 * Builds the fictional evaluation set: renders each letter with headless Chromium (Playwright, already a dev dep),
 * measures the deadline-sentence box from the DOM, and computes the true due date with the product's KPA engine.
 * Run: npx tsx eval/data/generate.ts   then   python3 -I eval/data/make_photos.py
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { computeKpaDeadline } from "../../src/lib/legal/deadlines";
import { ADDRESSES, NAMES, OFFICES, PURPOSES, type DocId } from "./corpus";
import { renderHtml, type Spec } from "./templates";

const here = dirname(fileURLToPath(import.meta.url));
const IMG = join(here, "images");

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261101);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const pl = (isoDay: string) => `${isoDay.slice(8)}.${isoDay.slice(5, 7)}.${isoDay.slice(0, 4)}`;
const addDays = (isoDay: string, n: number) => iso(new Date(Date.parse(`${isoDay}T00:00:00Z`) + n * 864e5));
const shuffle = <T,>(xs: T[]) => xs.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

const GENERAL: DocId[] = ["lease", "insurance", "photo", "passport", "funds", "fees", "work_contract"];
const ENROL_SETS: DocId[][] = [["enrolment"], ["enrolment"], ["enrolment", "tuition"], ["enrolment", "insurance"]];

const plan: Array<{ type: Spec["type"]; variant: string }> = [
  ...Array.from({ length: 8 }, () => ({ type: "wezwanie_braki" as const, variant: "general" })),
  ...Array.from({ length: 4 }, () => ({ type: "wezwanie_braki" as const, variant: "address" })),
  ...Array.from({ length: 3 }, () => ({ type: "wezwanie_dokumenty" as const, variant: "period" })),
  ...Array.from({ length: 3 }, () => ({ type: "wezwanie_dokumenty" as const, variant: "fixed" })),
  ...Array.from({ length: 3 }, () => ({ type: "decision" as const, variant: "positive" })),
  ...Array.from({ length: 3 }, () => ({ type: "decision" as const, variant: "negative" })),
  ...Array.from({ length: 4 }, (_, i) => ({ type: "appointment" as const, variant: i < 3 ? "fingerprints" : "card" })),
];
const DAYS_FOR = [14, 7, 14, 14, 7, 21, 14, 30, 14, 7, 14, 21];

function makeSpec(i: number, p: (typeof plan)[number]): Spec {
  const [honorific, name] = NAMES[i % NAMES.length];
  const officeKey = rand() < 0.65 ? "waw" : "krk";
  const o = OFFICES[officeKey];
  const letterIso = addDays("2026-09-14", int(0, 150));
  const filedIso = addDays(letterIso, -int(20, 70));
  const caseNumber = `${o.prefix}.${int(10000, 99999)}.2026`;
  const base: Spec = {
    id: `L${String(i + 1).padStart(2, "0")}`, type: p.type, variant: p.variant, office: o, caseNumber,
    letterDate: pl(letterIso), filedDate: pl(filedIso), honorific, name, address: pick(ADDRESSES),
    purpose: pick(PURPOSES), docs: [], days: 14, phraseIdx: int(0, 2),
  };
  if (p.type === "wezwanie_braki") {
    base.days = DAYS_FOR[i % DAYS_FOR.length];
    base.docs = p.variant === "address" ? shuffle<DocId>(["lease", "meldunek", "address_decl"]).slice(0, int(1, 3)) : shuffle(GENERAL).slice(0, int(2, 4));
  } else if (p.type === "wezwanie_dokumenty") {
    base.docs = ENROL_SETS[i % ENROL_SETS.length];
    if (p.variant === "fixed") base.fixedDate = pl(addDays(letterIso, int(16, 28)));
    else base.days = pick([7, 14]);
  } else if (p.type === "decision") {
    base.days = 14;
    base.positive = p.variant === "positive";
    base.validUntil = pl(addDays(letterIso, 365 * 2));
  } else {
    base.appointment = { date: pl(addDays(letterIso, int(10, 25))), time: `${pick(["08", "09", "10", "11", "13", "14"])}:${pick(["00", "20", "40", "15", "30"])}`, place: o.place, kind: p.variant === "card" ? "card" : "fingerprints" };
  }
  return base;
}

async function main() {
  mkdirSync(IMG, { recursive: true });
  const browser = await chromium.launch();
  const labels: unknown[] = [];
  for (const [i, p] of plan.entries()) {
    const s = makeSpec(i, p);
    const { html, deadlineSentence } = renderHtml(s);
    const ctx = await browser.newContext({ viewport: { width: 1240, height: 1754 } });
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const m = await page.evaluate(() => {
      const el = document.getElementById("dl")!;
      const rs = [...el.getClientRects()];
      const foot = document.querySelector(".foot")!.getBoundingClientRect();
      const sig = document.querySelector(".sig")!.getBoundingClientRect();
      return { x1: Math.min(...rs.map((r) => r.left)), y1: Math.min(...rs.map((r) => r.top)), x2: Math.max(...rs.map((r) => r.right)), y2: Math.max(...rs.map((r) => r.bottom)), overlap: sig.bottom > foot.top };
    });
    if (m.overlap) throw new Error(`${s.id}: content overlaps footer`);
    await page.screenshot({ path: join(IMG, `${s.id}_clean.png`) });
    await ctx.close();
    const box = [m.x1, m.y1, m.x2, m.y2].map((v) => Math.round(v));

    const [d, mo, y] = s.letterDate.split(".");
    const letterIso = `${y}-${mo}-${d}`;
    const deliveryDate = addDays(letterIso, int(3, 9));
    let deadlineKind: "period" | "fixed_date" | "none" = "none";
    let dueDate: string | null = null;
    let period: { amount: number; unit: "days" } | null = null;
    if (s.type === "wezwanie_braki" || (s.type === "wezwanie_dokumenty" && !s.fixedDate) || s.type === "decision") {
      deadlineKind = "period";
      period = { amount: s.days, unit: "days" };
      dueDate = computeKpaDeadline({ start: { kind: "delivery", date: deliveryDate }, period }).dueDate;
    } else if (s.fixedDate) {
      deadlineKind = "fixed_date";
      const [fd, fm, fy] = s.fixedDate.split(".");
      dueDate = `${fy}-${fm}-${fd}`;
    }
    const type = s.type;
    labels.push({
      id: s.id, type, variant: s.variant, caseNumber: s.caseNumber, office: s.office.name, letterDate: letterIso,
      addressee: `${s.honorific} ${s.name}`, legalBasis: s.type === "wezwanie_braki" ? "art. 64 § 2 KPA" : s.type === "wezwanie_dokumenty" ? "art. 50 § 1 KPA" : s.type === "decision" ? "art. 127 § 1 KPA" : "art. 50 § 1 KPA",
      documents: s.docs, period, deadlineKind, deadlineSentence, deliveryDate, dueDate,
      appointment: s.appointment ? { date: `${s.appointment.date.slice(6)}-${s.appointment.date.slice(3, 5)}-${s.appointment.date.slice(0, 2)}`, time: s.appointment.time } : null,
      images: [{ file: `${s.id}_clean.png`, variant: "clean", size: [1240, 1754], box }],
    });
    process.stdout.write(`${s.id} ${type}/${s.variant} due=${dueDate} box=${box}\n`);
  }
  await browser.close();
  writeFileSync(join(here, "labels.json"), JSON.stringify(labels, null, 2));
}
void main();
