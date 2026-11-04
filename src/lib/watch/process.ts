import { caseClient, CaseClientError } from "../case/client";
import type { CaseSnapshot } from "../case/types";
import { commitFindings } from "../onboarding/commit";
import type { Finding } from "../onboarding/findings";
import { ApiError } from "../server/http";
import type { ConnectionsEnv } from "../server/connections/types";
import { claimCall, claimMessage, finishMessage, recordCall } from "./state";
import { asksOf, deadlineOf, deadlinePatch, requestedDoc, draftDoc, eventId, isActionable, letterDoc, stableDocId, urgency, type Draft } from "./letter";
import { upsert } from "./write";
import type { Deps, WatchItem } from "./types";
import { reviewAfterNewLetter } from "@/lib/strategist";

export type AccountCtx = { accountId: string; userId: string; since: number; demo: boolean; email: string | null };

const code = (e: unknown) => (e instanceof ApiError || e instanceof CaseClientError ? (e.code ?? `http_${e.status}`) : e instanceof Error && "code" in e ? String((e as { code: unknown }).code) : "internal").slice(0, 60);

/** Claim, read, write the case, then (only then) notify. Returns null when the message belongs to another run or is not new. */
export async function processMessage(env: ConnectionsEnv, deps: Deps, a: AccountCtx, messageId: string): Promise<WatchItem | null> {
  const attempt = await claimMessage(env, a.accountId, messageId, deps.now());
  if (attempt === null) return null;
  const item: WatchItem = { messageId, subject: "", letterDocId: null, deadlineId: null, draftIds: [], called: false };
  try {
    const msg = await deps.read(env, a.accountId, messageId);
    item.subject = msg.subject;
    const receivedMs = Date.parse(msg.receivedAt);
    if (receivedMs < a.since) {
      await finishMessage(env, a.accountId, messageId, deps.now(), { status: "skipped", receivedAt: receivedMs });
      return null;
    }
    const c = caseClient(a.userId);
    const before = await c.snapshot();
    if (attempt === 1 && before.events.some((e) => e.id === eventId(messageId))) {
      await finishMessage(env, a.accountId, messageId, deps.now(), { status: "skipped", receivedAt: receivedMs });
      return null;
    }
    const reading = await deps.readMail(env, a.userId, msg, { fullName: before.profile.fullName, language: before.profile.preferredLanguage });
    if (!reading.relevant) {
      await finishMessage(env, a.accountId, messageId, deps.now(), { status: "done", receivedAt: receivedMs });
      return null;
    }
    const findings = reading.findings;
    await commitWithCalendar(env, deps, a, findings);
    const asks = asksOf(findings);
    const snap = await c.snapshot();
    const out = await draftsFor(env, deps, a, msg, snap, asks, isActionable(findings));
    const now = new Date(deps.now());
    const letterId = await stableDocId("ltr", messageId);
    const requested = requestedDoc(findings);
    const title = out.letterTitle || (requested ? `Request for ${requested.title.toLowerCase()}` : msg.subject);
    // (a) letter, (b) deadline, (c) drafts, (d) event: all before any call or email.
    await upsert(c, "documents", letterDoc({ id: letterId, title, msg, sender: reading.sender, asks }));
    const dl = deadlineOf(findings);
    if (dl) {
      await c.patch("deadlines", dl.id, deadlinePatch(letterId, now, a.demo));
      item.deadlineId = dl.id;
    }
    for (const d of out.drafts) {
      const id = await stableDocId("drf", messageId, d.kind);
      await upsert(c, "documents", draftDoc(id, d, letterId));
      item.draftIds.push(id);
    }
    const refs = [letterId, ...(dl ? [dl.id] : []), ...item.draftIds, ...findings.filter((f) => f !== dl).map((f) => f.id)].slice(0, 20);
    await upsert(c, "events", { id: eventId(messageId), type: "email_received", at: msg.receivedAt, summary: (reading.summary || `New letter from ${reading.sender || msg.from}: ${msg.subject}`).slice(0, 600), refs });
    item.letterDocId = letterId;
    await finishMessage(env, a.accountId, messageId, deps.now(), { status: "done", receivedAt: receivedMs, letterDocId: letterId });
    await notify(env, deps, a, item, { title, asks, sender: reading.sender || msg.from, findings, drafts: out.drafts, now });
    await reviewAfterNewLetter(env as never, a.userId);
    return item;
  } catch (e) {
    item.error = code(e);
    await finishMessage(env, a.accountId, messageId, deps.now(), { status: "failed", error: item.error }).catch(() => undefined);
    return item;
  }
}

/** Case writes always land; a calendar problem is retried once without the calendar and never blocks them. */
async function commitWithCalendar(env: ConnectionsEnv, deps: Deps, a: AccountCtx, findings: Finding[]): Promise<void> {
  const ids = { userId: a.userId, accountId: a.accountId };
  const base = { findings, summaries: [] as never[] };
  let calendar = false;
  try {
    calendar = await deps.hasCalendar(env, a.accountId);
  } catch {
    /* no calendar information: write the case only */
  }
  try {
    await commitFindings(env, ids, { ...base, addToCalendar: calendar });
  } catch (e) {
    if (!calendar || e instanceof CaseClientError) throw e;
    await commitFindings(env, ids, { ...base, addToCalendar: false });
  }
}

async function draftsFor(env: ConnectionsEnv, deps: Deps, a: AccountCtx, msg: Parameters<Deps["draft"]>[2], snap: CaseSnapshot, asks: string, actionable: boolean) {
  if (!actionable) return { letterTitle: "", drafts: [] as Draft[] };
  try {
    return await deps.draft(env, a.userId, msg, snap, asks);
  } catch {
    return { letterTitle: "", drafts: [] as Draft[] };
  }
}

async function notify(env: ConnectionsEnv, deps: Deps, a: AccountCtx, item: WatchItem, n: { title: string; asks: string; sender: string; findings: Finding[]; drafts: Draft[]; now: Date }): Promise<void> {
  const u = urgency(n.findings, n.now);
  if (a.demo) {
    if (!u.urgent || !u.dueDate) return;
    // The claim is the gate: overlapping ticks and retries can never place a second call.
    if (!(await claimCall(env, a.accountId, item.messageId, deps.now()))) return;
    try {
      const r = await deps.call(env, { accountId: a.accountId, userId: a.userId, letter: { title: n.title, sender: n.sender, asks: n.asks, dueDate: u.dueDate, ...(u.deadlineId ? { deadlineId: u.deadlineId } : {}), prepared: n.drafts.map((d) => `${d.title} (draft)`), ...(item.letterDocId ? { letterDocId: item.letterDocId } : {}), draftIds: item.draftIds } });
      item.called = true;
      await recordCall(env, a.accountId, item.messageId, { callSid: r.callSid });
    } catch (e) {
      item.error = `call_${code(e)}`;
      await recordCall(env, a.accountId, item.messageId, { error: item.error }).catch(() => undefined);
    }
    return;
  }
  if (a.email) item.emailed = await deps.email(env, a.email, { title: n.title, dueDate: u.dueDate ?? deadlineOf(n.findings)?.dueDate ?? null }).catch(() => false);
}
