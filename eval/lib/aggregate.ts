import { mean, pct } from "./stats";
import type { FieldScores } from "./score";

export interface JobResult {
  config: string; id: string; type: string; variant: string; ok: boolean; error?: string;
  scores: FieldScores; spark: number[] | null; sam: number[] | null; samSource: string | null; truthBox: number[] | null;
  iouSpark: number | null; iouSam: number | null; readMs: number; groundMs: number; samMs: number | null;
  costUsd: number; samUsd: number; tokensIn: number; tokensOut: number; retries: number; skipped?: boolean;
}

const rate = (xs: Array<boolean | null>) => {
  const v = xs.filter((x): x is boolean => x !== null);
  return v.length ? v.filter(Boolean).length / v.length : null;
};
const nums = (xs: Array<number | null>) => xs.filter((x): x is number => x !== null);

export function aggregate(jobs: JobResult[]) {
  const done = jobs.filter((j) => !j.skipped);
  const sub = (f: (j: JobResult) => boolean) => done.filter(f);
  const block = (js: JobResult[]) => ({
    n: js.length,
    failures: js.filter((j) => !j.ok).length,
    caseNumber: rate(js.map((j) => j.scores.caseNumber)),
    letterDate: rate(js.map((j) => j.scores.letterDate)),
    periodAmountUnit: rate(js.map((j) => j.scores.period)),
    startRuleDelivery: rate(js.map((j) => j.scores.startRule)),
    letterType: rate(js.map((j) => j.scores.type)),
    docsF1: mean(js.flatMap((j) => (j.scores.docs ? [j.scores.docs.f1] : []))),
    docsPrecision: mean(js.flatMap((j) => (j.scores.docs ? [j.scores.docs.p] : []))),
    docsRecall: mean(js.flatMap((j) => (j.scores.docs ? [j.scores.docs.r] : []))),
    deadlineCorrect: rate(js.map((j) => j.scores.deadlineCorrect)),
    appointmentExact: rate(js.map((j) => j.scores.appointment)),
    boxFound: rate(js.filter((j) => j.truthBox).map((j) => j.spark !== null)),
    iouSparkMean: mean(nums(js.map((j) => j.iouSpark))),
    iouSamMean: mean(nums(js.map((j) => j.iouSam))),
    iouSparkGe50: rate(js.filter((j) => j.iouSpark !== null).map((j) => (j.iouSpark ?? 0) >= 0.5)),
    iouSamGe50: rate(js.filter((j) => j.iouSam !== null).map((j) => (j.iouSam ?? 0) >= 0.5)),
    iouSparkGe75: rate(js.filter((j) => j.iouSpark !== null).map((j) => (j.iouSpark ?? 0) >= 0.75)),
    iouSamGe75: rate(js.filter((j) => j.iouSam !== null).map((j) => (j.iouSam ?? 0) >= 0.75)),
    samUsedMask: rate(js.filter((j) => j.samSource).map((j) => j.samSource === "sam")),
    latencyReadP50: pct(js.filter((j) => j.ok).map((j) => j.readMs), 0.5),
    latencyReadP95: pct(js.filter((j) => j.ok).map((j) => j.readMs), 0.95),
    latencySamP50: pct(nums(js.map((j) => j.samMs)), 0.5),
    costPerLetterUsd: mean(js.map((j) => j.costUsd + j.samUsd)),
    costModelOnlyUsd: mean(js.map((j) => j.costUsd)),
    tokensInMean: mean(js.map((j) => j.tokensIn)),
    tokensOutMean: mean(js.map((j) => j.tokensOut)),
    totalUsd: js.reduce((a, j) => a + j.costUsd + j.samUsd, 0),
  });
  return {
    all: block(done),
    clean: block(sub((j) => j.variant === "clean")),
    photo: block(sub((j) => j.variant !== "clean")),
    byType: Object.fromEntries([...new Set(done.map((j) => j.type))].map((t) => [t, block(sub((j) => j.type === t))])),
  };
}
