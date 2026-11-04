import { extractJson } from "../model/json";
import { estimateInputTokens } from "../model/cost";
import type { CaseSnapshot } from "../case/types";
import { caseText, makeMasker, SYSTEM } from "./prompt";
import { runTool, TOOL_DEFS } from "./tools";
import type { WMessage, WonderClient } from "./transport";
import { costOf, LIMITS, reviewJsonSchema, reviewSchema, StrategistError, WONDER_PRICE, type Proposal, type Review, type StopReason, type Usage } from "./types";

/** Hooks the caller supplies so the loop stays testable: spend accounting and the per-user day guard. */
export interface Meter {
  /** USD this user already spent on reviews in the last 24 h (before this run). */
  spentBefore: number;
  reserve(estimateUsd: number): Promise<void>;
  settle(reservedUsd: number, actualUsd: number): Promise<void>;
}

export interface AgentOut {
  review: Review;
  proposals: Proposal[];
  usage: Usage;
  costUsd: number;
  rounds: number;
  toolCalls: number;
  stop: StopReason;
}

const addU = (a: Usage, b: Usage): Usage => ({ tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut, cachedTokens: a.cachedTokens + b.cachedTokens });
const estimate = (messages: unknown, maxTokens: number) => (estimateInputTokens([messages, TOOL_DEFS]) * WONDER_PRICE.in + maxTokens * WONDER_PRICE.out) / 1_000_000;

/** Parses and validates a final answer; returns null when it is not a valid review. */
function tryReview(content: string | null): Review | null {
  if (!content) return null;
  try {
    const r = reviewSchema.safeParse(extractJson(content));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/**
 * Multi-step tool loop: up to LIMITS.maxToolRounds rounds of tool calls executed here, then (or earlier, once the model
 * answers) a final structured answer. Stops on budget, time, or round limit by asking for the answer with no tools.
 */
export async function runAgent(client: WonderClient, snapshot: CaseSnapshot, meter: Meter, now: Date = new Date(), clock: () => number = Date.now): Promise<AgentOut> {
  const masker = makeMasker(snapshot);
  const ctx = { snapshot, masker, proposals: [] as Proposal[] };
  const messages: WMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `Review this case now and answer with the JSON object.\n\n${caseText(snapshot, now, masker)}` },
  ];
  const started = clock();
  let usage: Usage = { tokensIn: 0, tokensOut: 0, cachedTokens: 0 };
  let cost = 0;
  let rounds = 0;
  let toolCalls = 0;
  let stop: StopReason = "final";

  /** One metered model call. Throws user_budget when this user's day allowance cannot cover it. */
  const call = async (withTools: boolean, json: boolean, last = false) => {
    const est = estimate(messages, LIMITS.maxTokens);
    const projected = estimate(messages, 6000);
    if (meter.spentBefore + cost + (last ? 0 : projected) > LIMITS.userDailyUsd) throw new StrategistError("Daily case-review allowance reached", "user_budget", 429);
    await meter.reserve(est);
    try {
      const res = await client.complete({ messages, maxTokens: LIMITS.maxTokens, ...(withTools ? { tools: TOOL_DEFS } : {}), ...(json ? { json: reviewJsonSchema } : {}) });
      const actual = costOf(res.usage);
      usage = addU(usage, res.usage);
      cost += actual;
      await meter.settle(est, actual);
      return res;
    } catch (e) {
      await meter.settle(est, 0);
      throw e;
    }
  };

  const finish = (review: Review): AgentOut => ({ review: masker.restoreDeep(review), proposals: ctx.proposals, usage, costUsd: cost, rounds, toolCalls, stop });

  for (; rounds < LIMITS.maxToolRounds; ) {
    if (clock() - started > LIMITS.totalMs - LIMITS.callTimeoutMs) { stop = "time"; break; }
    let res;
    try {
      res = await call(true, false);
    } catch (e) {
      if (e instanceof StrategistError && e.code === "user_budget" && rounds > 0) { stop = "budget"; break; }
      throw e;
    }
    if (!res.toolCalls.length) {
      const review = tryReview(res.content);
      if (review) return finish(review);
      messages.push({ role: "assistant", content: res.content ?? "" }, { role: "user", content: "Reply with only the JSON object in the required shape." });
      rounds++;
      continue;
    }
    rounds++;
    messages.push({ role: "assistant", content: res.content, tool_calls: res.toolCalls });
    for (const tc of res.toolCalls) {
      toolCalls++;
      messages.push({ role: "tool", tool_call_id: tc.id, content: runTool(tc.function.name, tc.function.arguments, ctx) });
    }
    if (rounds >= LIMITS.maxToolRounds) stop = "round_limit";
  }
  if (stop === "final") stop = "round_limit";

  // Finalise: no tools, schema-constrained, from whatever was gathered. A budget error here is fatal (no review to store).
  messages.push({ role: "user", content: "Stop using tools. Give your final answer now as the JSON object, using what you have gathered." });
  const res = await call(false, true, true);
  const review = tryReview(res.content);
  if (!review) throw new StrategistError("The review did not match the required format", "invalid_output");
  return finish(review);
}
