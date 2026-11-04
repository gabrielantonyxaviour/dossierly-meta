import { describe, expect, it } from "vitest";
import { caseClient } from "../../src/lib/case/client";
import { extractionSchema } from "../../src/lib/onboarding/extract";
import { buildFindings } from "../../src/lib/onboarding/findings";
import type { MessageBody } from "../../src/lib/onboarding/inbox";
import type { ConnectionsEnv } from "../../src/lib/server/connections/types";
import { freshLocalEnv } from "../../src/lib/server/local";
import { runWatchTick } from "../../src/lib/watch/tick";
import type { Deps } from "../../src/lib/watch/types";

const NOW = Date.parse("2026-11-04T10:00:00Z");
const CONNECTED = Date.parse("2026-11-01T08:00:00Z");
const CASE_NO = "WSC-II-P.6151.48213.2026";
let n = 0;

function msg(id: string, receivedAt = "2026-11-04T09:30:00.000Z"): MessageBody {
  return { id, from: "Wydział Spraw Cudzoziemców <wsc@mazowieckie.example>", subject: "Wezwanie do przedstawienia zaświadczenia z uczelni", receivedAt, text: "Prosimy o przedstawienie zaświadczenia o kontynuowaniu nauki do 2026-11-25.", images: [], attachments: [] };
}

const extraction = extractionSchema.parse({
  relevant: true, category: "summons", sender: "Mazowiecki Urząd Wojewódzki", summary: "The office wants proof you are enrolled by 25 November 2026.",
  facts: { caseNumber: CASE_NO }, appointment: null,
  deadline: { title: "Send the certificate of enrolment", days: null, from: null, letterDate: null, statedDate: "2026-11-25", quote: "do 2026-11-25", consequence: "Your application will be left unexamined" },
  documents: [{ title: "Certificate of enrolment", kind: "university_certificate", status: "requested" }], tasks: [],
});

async function setup(opts: { demo: boolean; failFirstRead?: boolean; inSetup?: boolean }) {
  const id = `acct-watch-${++n}`;
  const email = opts.demo ? "darthstormer.ai@gmail.com" : `student${n}@example.pl`;
  const env = freshLocalEnv({ DEMO_CALL_EMAILS: "darthstormer.ai@gmail.com" } as never) as ConnectionsEnv;
  await env.DB.prepare("INSERT INTO users (id, created_at) VALUES (?, 1)").bind(id).run();
  await env.DB.prepare("INSERT INTO connection_accounts (account_id, category, provider, broker_id, auth_config_id, label, scopes, connected_at) VALUES (?, 'mail', 'gmail', 'b1', 'a1', 'arjun@gmail.com', '[]', ?)").bind(id, CONNECTED).run();
  await env.DB.prepare("INSERT INTO email_identities (email, user_id, verified_at) VALUES (?, ?, 1)").bind(email, id).run();
  if (!opts.inSetup) await env.DB.prepare("INSERT INTO onboarding_progress (account_id, step, completed_at, updated_at) VALUES (?, 6, ?, ?)").bind(id, CONNECTED + 60_000, CONNECTED + 60_000).run();
  await caseClient(id).patchProfile({ fullName: "Arjun Raman", preferredLanguage: "en", organisation: "Uniwersytet Warszawski" });
  const log = { reads: 0, readMail: 0, calls: [] as unknown[], emails: [] as unknown[], callState: null as null | { letter: boolean; draft: boolean; event: boolean; deadline: unknown }, since: 0 };
  let failed = !opts.failFirstRead;
  const deps: Deps = {
    now: () => NOW,
    listIds: async (_e, _r, since) => { log.since = since; return ["m_late"]; },
    read: async (_e, _a, mid) => { log.reads++; return msg(mid); },
    readMail: async (_e, _u, m) => {
      log.readMail++;
      if (!failed) { failed = true; throw Object.assign(new Error("x"), { code: "model_unavailable" }); }
      return buildFindings(m, extraction, "en");
    },
    draft: async () => ({ letterTitle: "Request for a certificate of enrolment", drafts: [
      { kind: "reply", title: "Reply to the office", to: "Mazowiecki Urząd Wojewódzki", subject: `Sprawa ${CASE_NO}`, body: `Szanowni Państwo, w odpowiedzi na wezwanie w sprawie ${CASE_NO} przesyłam zaświadczenie. Arjun Raman`, language: "pl" },
      { kind: "institution", title: "Request to the dean’s office", to: "Dziekanat, Uniwersytet Warszawski", subject: "Prośba o zaświadczenie", body: "Proszę o wydanie zaświadczenia o kontynuowaniu nauki. Arjun Raman", language: "pl" },
    ] }),
    hasCalendar: async () => false,
    call: async (_e, a) => {
      const s = await caseClient(a.userId).snapshot();
      log.callState = { letter: s.documents.some((d) => d.id.startsWith("ltr_")), draft: s.documents.filter((d) => d.id.startsWith("drf_")).length === 2, event: s.events.some((e) => e.id === "evt_m_late"), deadline: s.deadlines[0]?.triggeredBy };
      log.calls.push(a);
      return { callSid: "CA123", to: "…00" };
    },
    email: async (_e, to, a) => { log.emails.push({ to, ...a }); return true; },
  };
  return { id, env, deps, log };
}

describe("inbox watcher tick", () => {
  it("writes the letter, deadline, drafts and event, and only then places the call (demo account)", async () => {
    const { id, env, deps, log } = await setup({ demo: true });
    const r = await runWatchTick(env, { accountId: id }, deps);
    expect(r).toMatchObject({ checked: 1, found: 1 });
    const item = r.processed[0];
    expect(item.called).toBe(true);
    expect(log.calls).toHaveLength(1);
    expect(log.callState).toEqual({ letter: true, draft: true, event: true, deadline: item.letterDocId });
    const s = await caseClient(id).snapshot();
    const letter = s.documents.find((d) => d.id === item.letterDocId)!;
    expect(letter).toMatchObject({ kind: "letter", source: "email", status: "have", title: "Request for a certificate of enrolment" });
    expect(letter.extractedFields).toMatchObject({ received: "2026-11-04", asks: "Send the certificate of enrolment; Certificate of enrolment" });
    expect(letter.extractedFields.subject).toContain("Wezwanie");
    const dl = s.deadlines.find((d) => d.id === item.deadlineId)!;
    expect(dl).toMatchObject({ title: "Send the certificate of enrolment", dueDate: "2026-11-25", triggeredBy: letter.id, status: "open" });
    expect(dl.computation.steps.length).toBeGreaterThan(0);
    expect(dl.reminders).toEqual([{ at: "2026-11-05T09:00:00+01:00", channel: "call", sentAt: null }]);
    const drafts = s.documents.filter((d) => item.draftIds.includes(d.id));
    expect(drafts.map((d) => d.title).sort()).toEqual(["Reply to the office", "Request to the dean’s office"]);
    for (const d of drafts) {
      expect(d).toMatchObject({ kind: "letter", source: "agent", status: "have" });
      expect(d.extractedFields).toMatchObject({ language: "pl", triggeredBy: letter.id });
      expect(d.extractedFields.draft.length).toBeLessThanOrEqual(1000);
    }
    const evts = s.events.filter((e) => e.id.startsWith("evt_"));
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ type: "email_received", at: "2026-11-04T09:30:00.000Z" });
    expect(evts[0].refs.slice(0, 2 + drafts.length)).toEqual([letter.id, dl.id, ...item.draftIds]);
    const call = log.calls[0] as { letter: { dueDate: string; prepared: string[]; deadlineId: string } };
    expect(call.letter).toMatchObject({ dueDate: "2026-11-25", deadlineId: dl.id });
    expect(call.letter.prepared).toEqual(["Reply to the office (draft)", "Request to the dean’s office (draft)"]);
    const row = await env.DB.prepare("SELECT status, call_sid, letter_doc_id, called_at FROM watch_messages WHERE account_id = ?").bind(id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: "done", call_sid: "CA123", letter_doc_id: letter.id });
    expect(row?.called_at).toBe(NOW);
  });

  it("two overlapping ticks process the message once and call once", async () => {
    const { id, env, deps, log } = await setup({ demo: true });
    await Promise.all([runWatchTick(env, { accountId: id }, deps), runWatchTick(env, { accountId: id }, deps)]);
    expect(log.readMail).toBe(1);
    expect(log.calls).toHaveLength(1);
    expect((await caseClient(id).snapshot()).events.filter((e) => e.id.startsWith("evt_"))).toHaveLength(1);
  });

  it("a later tick never repeats a finished message or its call", async () => {
    const { id, env, deps, log } = await setup({ demo: true });
    await runWatchTick(env, { accountId: id }, deps);
    await env.DB.prepare("UPDATE watch_accounts SET lock_until = 0 WHERE account_id = ?").bind(id).run();
    const again = await runWatchTick(env, { accountId: id }, deps);
    expect(again.processed).toHaveLength(0);
    expect(log.calls).toHaveLength(1);
    expect(log.reads).toBe(1);
  });

  it("baselines at the connect time and ignores mail from before it", async () => {
    const { id, env, deps, log } = await setup({ demo: true });
    deps.read = async (_e, _a, mid) => { log.reads++; return msg(mid, "2026-10-20T09:00:00.000Z"); };
    const r = await runWatchTick(env, { accountId: id }, deps);
    expect(log.since).toBe(CONNECTED);
    expect(r.processed).toHaveLength(0);
    expect(log.readMail).toBe(0);
    expect(log.calls).toHaveLength(0);
    const row = await env.DB.prepare("SELECT status FROM watch_messages WHERE account_id = ?").bind(id).first<{ status: string }>();
    expect(row?.status).toBe("skipped");
  });

  it("skips mail the onboarding import already saved", async () => {
    const { id, env, deps, log } = await setup({ demo: true });
    await caseClient(id).create("events", { id: "evt_m_late", type: "email_received", at: "2026-11-04T09:30:00.000Z", summary: "Imported during setup", refs: [] });
    await runWatchTick(env, { accountId: id }, deps);
    expect(log.readMail).toBe(0);
    expect(log.calls).toHaveLength(0);
  });

  it("does not call a non-demo account; it emails a short notice instead", async () => {
    const { id, env, deps, log } = await setup({ demo: false });
    const r = await runWatchTick(env, { accountId: id }, deps);
    expect(log.calls).toHaveLength(0);
    expect(r.processed[0]).toMatchObject({ called: false, emailed: true });
    expect(log.emails).toEqual([{ to: expect.stringContaining("@example.pl"), title: "Request for a certificate of enrolment", dueDate: "2026-11-25" }]);
    const dl = (await caseClient(id).snapshot()).deadlines[0];
    expect(dl.reminders[0].channel).toBe("in_app");
  });

  it("retries a failed message once more and still calls only once", async () => {
    const { id, env, deps, log } = await setup({ demo: true, failFirstRead: true });
    const first = await runWatchTick(env, { accountId: id }, deps);
    expect(first.processed[0].error).toBe("model_unavailable");
    expect(log.calls).toHaveLength(0);
    await env.DB.prepare("UPDATE watch_accounts SET lock_until = 0 WHERE account_id = ?").bind(id).run();
    const second = await runWatchTick(env, { accountId: id }, deps);
    expect(second.processed[0].error).toBeUndefined();
    expect(log.calls).toHaveLength(1);
    const row = await env.DB.prepare("SELECT status, attempts FROM watch_messages WHERE account_id = ?").bind(id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: "done", attempts: 2 });
  });

  it("records a failed call instead of throwing", async () => {
    const { id, env, deps } = await setup({ demo: true });
    deps.call = async () => { throw Object.assign(new Error("x"), { code: "calls_unconfigured" }); };
    const r = await runWatchTick(env, { accountId: id }, deps);
    expect(r.processed[0]).toMatchObject({ called: false, error: "call_calls_unconfigured" });
    const row = await env.DB.prepare("SELECT status, error FROM watch_messages WHERE account_id = ?").bind(id).first<Record<string, unknown>>();
    expect(row).toMatchObject({ status: "done", error: "call_calls_unconfigured" });
  });

  it("leaves the inbox to the onboarding import while setup is running", async () => {
    const { env, deps, log, id } = await setup({ demo: true, inSetup: true });
    const r = await runWatchTick(env, { accountId: id }, deps);
    expect(r.found).toBe(0);
    expect(log.reads).toBe(0);
    expect(log.calls).toHaveLength(0);
  });
});
