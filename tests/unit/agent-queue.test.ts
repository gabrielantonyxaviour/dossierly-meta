import { describe, expect, it, vi } from "vitest";
import { FALLBACK_AFTER_MS, STALE_CLAIM_MS, claimForCloud, enqueueAgentTask, getTask, taskView } from "@/lib/agent/queue";
import { advanceTask } from "@/lib/agent/service";
import { listLedger } from "@/lib/server/ledger";
import { freshLocalEnv } from "@/lib/server/local";
import type { ChatClient } from "@/lib/model/types";

const CASE = {
  id: "case-1", office: "Mazowiecki Voivodeship Office, Warsaw", caseNumber: "WSC-II-P.6151.48213.2026",
  profile: { name: "Arjun Raman", language: "en" as const },
  events: [{ id: "e1", date: "2026-10-27", kind: "letter" as const, title: "Summons for health insurance proof", summary: "14 days from delivery" }],
  documents: [{ name: "Health insurance certificate", have: false }, { name: "Passport", have: true }],
  deadlines: [],
};
const PASSAGE = {
  url: "https://www.gov.pl/web/udsc/zezwolenie-na-pobyt-czasowy-i-prace",
  title: "Temporary residence and work permit",
  text: "The applicant must submit proof of health insurance or a document confirming payment of health insurance costs.",
};
const prepareInput = (extra = {}) => ({
  appointment: { office: CASE.office, purpose: "Submit missing documents", date: "2026-11-05" },
  case: CASE, language: "en", passages: [PASSAGE], ...extra,
});
const validPrepare = {
  checklist: [{ item: "Proof of health insurance", status: "missing", citation: { url: PASSAGE.url, title: PASSAGE.title, quote: "proof of health insurance or a document confirming payment" } }],
  phrases: [{ local: "Dzień dobry, przyszedłem złożyć brakujące dokumenty.", user: "Good day, I came to submit the missing documents." }],
  changes: [],
};

const NOSTART = { start: false } as const;

describe("agent queue", () => {
  it("rejects malformed input before queueing", async () => {
    const env = freshLocalEnv();
    await expect(enqueueAgentTask(env, { userId: "u", kind: "prepare", input: { case: CASE } })).rejects.toThrow();
    const { results } = await env.DB.prepare("SELECT id FROM tasks").all();
    expect(results).toHaveLength(0);
  });

  it("starts the run in the Worker at enqueue time, exactly once", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const schedule = vi.fn();
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() }, { schedule });
    expect(schedule).toHaveBeenCalledTimes(1);
    const row = (await getTask(env, taskId))!;
    expect(row).toMatchObject({ status: "running", ran_on: "cloud" });
    expect(await claimForCloud(env, { id: taskId, status: "queued", claimed_at: null })).toBe(false);
  });

  it("files an event without a model call", async () => {
    const env = freshLocalEnv();
    const jobs: Array<() => Promise<unknown>> = [];
    const event = { id: "e9", date: "2026-10-28", kind: "letter", title: "Summons", summary: "14 days", refs: [] };
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "file", input: { event, case: CASE } }, { schedule: (w) => void jobs.push(w) });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!) as unknown as { status: string; result: { filed: boolean } };
    expect(view.status).toBe("done");
    expect(view.result.filed).toBe(true);
  });
});

describe("cloud fallback timing", () => {
  const fakeClient = (content: string): ChatClient => ({
    chat: vi.fn(async () => ({ content, usage: { tokensIn: 900, tokensOut: 300, cachedTokens: 0 } })),
  });

  it("leaves a fresh queued task alone, starts an unstarted one at 20 s", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() }, NOSTART);
    const row = (await getTask(env, taskId))!;
    const schedule = vi.fn();
    const early = await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS - 1, { schedule });
    expect(early.status).toBe("queued");
    expect(schedule).not.toHaveBeenCalled();
    const late = await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS, { schedule });
    expect(late.status).toBe("running");
    expect(late.ran_on).toBe("cloud");
    expect(schedule).toHaveBeenCalledTimes(1);
    // A second poll must not start a second cloud run.
    await advanceTask(env, row, row.created_at + FALLBACK_AFTER_MS + 500, { schedule });
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("runs the cloud model and stores a validated, cited result with ranOn cloud", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() }, NOSTART);
    const client = fakeClient(JSON.stringify(validPrepare));
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 25_000, { schedule: (w) => void jobs.push(w), client });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!);
    expect(view.status).toBe("done");
    expect(view.ranOn).toBe("cloud");
    expect((view as unknown as { result: typeof validPrepare }).result.checklist[0].citation.url).toBe(PASSAGE.url);
    expect((view as unknown as { run: { ranOn: string } }).run.ranOn).toBe("cloud");
    expect((await listLedger(env, "u1", 10)).entries[0].what).toContain("muse-spark-1.3");
  });

  it("repairs a fabricated quote from the passage, takes status from the case and drops a citation outside the provided passages", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "prepare", input: prepareInput() }, NOSTART);
    const bad = {
      ...validPrepare,
      checklist: [
        { ...validPrepare.checklist[0], status: "have", citation: { ...validPrepare.checklist[0].citation, quote: "a sentence the source never says" } },
        { item: "Invented fee", status: "missing", citation: { url: "https://example.com/x", title: "x", quote: "pay 500 PLN" } },
      ],
    };
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 21_000, { schedule: (w) => void jobs.push(w), client: fakeClient(JSON.stringify(bad)) });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!) as unknown as { result: typeof validPrepare };
    expect(view.result.checklist).toHaveLength(1);
    // The model claimed "have"; the case lists the health insurance certificate as not held.
    expect(view.result.checklist[0].status).toBe("missing");
    expect(view.result.checklist[0].citation.quote.toLowerCase()).toContain("health insurance");
  });

  it("fails cleanly when the model never returns valid JSON", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "ask", input: { question: "Why?", case: CASE, language: "en" } }, NOSTART);
    const jobs: Array<() => Promise<unknown>> = [];
    const row = (await getTask(env, taskId))!;
    await advanceTask(env, row, row.created_at + 30_000, { schedule: (w) => void jobs.push(w), client: fakeClient("sorry, no") });
    await jobs[0]();
    const view = taskView((await getTask(env, taskId))!);
    expect(view.status).toBe("failed");
    expect(JSON.stringify(view)).not.toContain("sorry, no");
  });

  it("takes over a run that went silent after 3 minutes", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "test" });
    const { taskId } = await enqueueAgentTask(env, { userId: "u1", kind: "ask", input: { question: "Q", case: CASE, language: "en" } }, NOSTART);
    const row0 = (await getTask(env, taskId))!;
    expect(await claimForCloud(env, row0, 1_000_000)).toBe(true);
    const claimed = (await getTask(env, taskId))!;
    const schedule = vi.fn();
    await advanceTask(env, claimed, 1_000_000 + STALE_CLAIM_MS - 1, { schedule });
    expect(schedule).not.toHaveBeenCalled();
    await advanceTask(env, claimed, 1_000_000 + STALE_CLAIM_MS, { schedule });
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
