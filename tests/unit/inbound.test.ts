import { describe, expect, it } from "vitest";
import { caseClient } from "../../src/lib/case/client";
import { extractionSchema } from "../../src/lib/onboarding/extract";
import { buildFindings } from "../../src/lib/onboarding/findings";
import type { ConnectionsEnv } from "../../src/lib/server/connections/types";
import { freshLocalEnv } from "../../src/lib/server/local";
import { accountForRecipient, generateLocalPart, getOrCreateAddress, rotateAddress, type InboundEnv } from "../../src/lib/inbound/address";
import { handleInbound, MAX_RAW_BYTES, retryInbound, type InboundMessage } from "../../src/lib/inbound/handle";
import type { Deps } from "../../src/lib/watch/types";

type E = ConnectionsEnv & InboundEnv;
let n = 0;
async function setup() {
  const id = `acct-inb-${++n}`;
  const env = freshLocalEnv({ INBOUND_MAIL_DOMAIN: "in.example.test" } as never) as E;
  await env.DB.prepare("INSERT INTO users (id, created_at) VALUES (?, 1)").bind(id).run();
  await env.DB.prepare("INSERT INTO email_identities (email, user_id, verified_at) VALUES (?, ?, 1)").bind(`s${n}@example.pl`, id).run();
  await caseClient(id).patchProfile({ fullName: "Arjun Raman", preferredLanguage: "en", organisation: "Uniwersytet Warszawski" });
  return { id, env };
}
const extraction = extractionSchema.parse({
  relevant: true, category: "summons", sender: "Mazowiecki Urząd Wojewódzki", summary: "Proof of enrolment is due.", facts: { caseNumber: "WSC-II-P.6151.48213.2026" }, appointment: null,
  deadline: { title: "Send the certificate", days: null, from: null, letterDate: null, statedDate: "2026-11-25", quote: "do 2026-11-25", consequence: "Left unexamined" },
  documents: [{ title: "Certificate of enrolment", kind: "university_certificate", status: "requested" }], tasks: [],
});
function deps(log: { reads: number }, fail = false): Deps {
  let failed = !fail;
  return {
    now: () => Date.now(), listIds: async () => [], read: async () => { throw new Error("unused"); },
    readMail: async (_e, _u, m) => { log.reads++; if (!failed) { failed = true; throw Object.assign(new Error("x"), { code: "model_unavailable" }); } return buildFindings(m, extraction, "en"); },
    draft: async () => ({ letterTitle: "Send the certificate", drafts: [] }), hasCalendar: async () => false,
    call: async () => ({ callSid: "CA1", to: "x" }), email: async () => true,
  };
}
const mime = (o: { id?: string; to: string; from?: string; subject?: string; body?: string; extra?: string }) => [
  `From: ${o.from ?? "Arjun Raman <arjun@example.pl>"}`, `To: ${o.to}`, `Subject: ${o.subject ?? "Fwd: Wezwanie do przedstawienia zaświadczenia"}`,
  ...(o.id ? [`Message-ID: <${o.id}>`] : []), "Date: Wed, 04 Nov 2026 09:30:00 +0000", "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "", o.body ?? "Prosimy o przedstawienie zaświadczenia do 2026-11-25.",
].join("\r\n");
function msg(to: string, raw: string, rawSize?: number) {
  const bytes = new TextEncoder().encode(raw); const rejected: string[] = [];
  const m: InboundMessage = { to, from: "arjun@example.pl", rawSize: rawSize ?? bytes.byteLength, setReject: (r) => rejected.push(r), raw: new Response(bytes).body! };
  return { m, rejected };
}

describe("forwarding address", () => {
  it("generates unguessable, well-formed, distinct local parts", () => {
    const set = new Set(Array.from({ length: 2000 }, generateLocalPart));
    expect(set.size).toBe(2000);
    for (const s of set) expect(s).toMatch(/^case-[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
  });
  it("creates once, returns the same address, and gives each account its own", async () => {
    const a = await setup(), b = await setup();
    const first = await getOrCreateAddress(a.env, a.id);
    expect(first.address).toMatch(/^case-[a-z0-9]{10}@in\.example\.test$/);
    expect((await getOrCreateAddress(a.env, a.id)).address).toBe(first.address);
    expect((await getOrCreateAddress(b.env, b.id)).address).not.toBe(first.address);
  });
  it("defaults the domain to in.larinova.com", async () => {
    const env = freshLocalEnv() as E; await env.DB.prepare("INSERT INTO users (id, created_at) VALUES ('d1', 1)").run();
    expect((await getOrCreateAddress(env, "d1")).address).toMatch(/@in\.larinova\.com$/);
  });
  it("rotation replaces the address, kills the old one and never reissues it", async () => {
    const { id, env } = await setup();
    const old = (await getOrCreateAddress(env, id)).address;
    expect(await accountForRecipient(env, old)).toBe(id);
    const next = await rotateAddress(env, id);
    expect(next.address).not.toBe(old); expect(next.rotatedAt).toBeTypeOf("number");
    expect(await accountForRecipient(env, old)).toBeNull();
    expect(await accountForRecipient(env, next.address)).toBe(id);
    const retired = await env.DB.prepare("SELECT account_id FROM inbound_retired WHERE local_part = ?").bind(old.split("@")[0]).first<{ account_id: string }>();
    expect(retired?.account_id).toBe(id);
  });
  it("maps recipients case-insensitively on our domain only", async () => {
    const { id, env } = await setup();
    const a = (await getOrCreateAddress(env, id)).address;
    expect(await accountForRecipient(env, a.toUpperCase())).toBe(id);
    expect(await accountForRecipient(env, `<${a}>`)).toBe(id);
    expect(await accountForRecipient(env, a.replace("@in.example.test", "@evil.test"))).toBeNull();
    expect(await accountForRecipient(env, "case-aaaaaaaaaa@in.example.test")).toBeNull();
    expect(await accountForRecipient(env, "nobody@in.example.test")).toBeNull();
  });
});

describe("inbound mail", () => {
  it("rejects an unknown recipient and a rotated address", async () => {
    const { id, env } = await setup();
    const unknown = msg("case-zzzzzzzzzz@in.example.test", mime({ to: "x" }));
    expect(await handleInbound(env, unknown.m, deps({ reads: 0 }))).toMatchObject({ status: "rejected" });
    expect(unknown.rejected).toEqual(["Unknown recipient."]);
    const old = (await getOrCreateAddress(env, id)).address; await rotateAddress(env, id);
    const stale = msg(old, mime({ to: old, id: "a@x" }));
    expect((await handleInbound(env, stale.m, deps({ reads: 0 }))).status).toBe("rejected");
  });
  it("rejects over 20 MB by declared size and by actual stream length", async () => {
    const { id, env } = await setup(); const to = (await getOrCreateAddress(env, id)).address;
    const declared = msg(to, mime({ to }), MAX_RAW_BYTES + 1);
    expect(await handleInbound(env, declared.m, deps({ reads: 0 }))).toMatchObject({ status: "rejected" });
    expect(declared.rejected[0]).toMatch(/too large/);
    const liar = msg(to, mime({ to, body: "x".repeat(MAX_RAW_BYTES + 10) }), 100);
    expect((await handleInbound(env, liar.m, deps({ reads: 0 }))).status).toBe("rejected");
    expect(liar.rejected[0]).toMatch(/too large/);
  });
  it("writes the letter into the case, and the same Message-ID twice is processed once", async () => {
    const { id, env } = await setup(); const to = (await getOrCreateAddress(env, id)).address; const log = { reads: 0 };
    const first = await handleInbound(env, msg(to, mime({ to, id: "abc123@mail.example" })).m, deps(log));
    expect(first.status).toBe("processed");
    const again = await handleInbound(env, msg(to, mime({ to, id: "ABC123@mail.example" })).m, deps(log));
    expect(again.status).toBe("duplicate");
    expect(log.reads).toBe(1);
    const s = await caseClient(id).snapshot();
    expect(s.documents.filter((d) => d.id.startsWith("ltr_"))).toHaveLength(1);
    expect(s.documents.find((d) => d.id.startsWith("ltr_"))).toMatchObject({ source: "email" });
  });
  it("keeps a failed run and retries it from the stored copy", async () => {
    const { id, env } = await setup(); const to = (await getOrCreateAddress(env, id)).address; const log = { reads: 0 };
    const d = deps(log, true);
    expect((await handleInbound(env, msg(to, mime({ to, id: "fail1@mail.example" })).m, d)).status).toBe("failed");
    expect((await caseClient(id).snapshot()).documents.filter((x) => x.id.startsWith("ltr_"))).toHaveLength(0);
    expect(await retryInbound(env, d)).toBe(1);
    expect((await caseClient(id).snapshot()).documents.filter((x) => x.id.startsWith("ltr_"))).toHaveLength(1);
  });
  it("keeps a Gmail forwarding confirmation for the user instead of reading it as a letter", async () => {
    const { id, env } = await setup(); const to = (await getOrCreateAddress(env, id)).address; const log = { reads: 0 };
    const raw = mime({ to, id: "gc1@google.com", from: "Gmail Team <forwarding-noreply@google.com>", subject: "Gmail Forwarding Confirmation - Receive Mail from arjun@gmail.com",
      body: "Confirmation code: 123456789\r\nTo confirm: https://mail.google.com/mail/vf-%5BANGjdJ%5D-abc" });
    expect((await handleInbound(env, msg(to, raw).m, deps(log))).status).toBe("confirmation");
    expect(log.reads).toBe(0);
    expect((await getOrCreateAddress(env, id)).forwardingConfirmation).toMatchObject({ code: "123456789", link: expect.stringContaining("https://mail.google.com/mail/vf-") });
  });
});
