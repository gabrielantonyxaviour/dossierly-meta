import { describe, expect, it } from "vitest";
import { buildFindings } from "../../src/lib/onboarding/findings";
import { extractionSchema } from "../../src/lib/onboarding/extract";
import { deadlinePatch, tomorrowNine, urgency } from "../../src/lib/watch/letter";
import { watchQuery } from "../../src/lib/watch/list";
import { claimMessage, ensureAccount, lockAccount } from "../../src/lib/watch/state";
import { freshLocalEnv } from "../../src/lib/server/local";

const msg = { id: "m1", from: "WSC", subject: "Wezwanie", receivedAt: "2026-11-04T09:30:00.000Z", text: "", images: [], attachments: [] };
const base = extractionSchema.parse({ relevant: true, category: "summons", sender: "WSC", summary: "s", facts: {}, appointment: null, deadline: null, documents: [], tasks: [] });
const dl = (date: string) => buildFindings(msg, { ...base, deadline: { title: "Send it", days: null, from: null, letterDate: null, statedDate: date, quote: "", consequence: "", legalBasis: null } }, "en").findings;
const apt = (date: string) => buildFindings(msg, { ...base, appointment: { title: "Fingerprints", date, time: "10:30", place: "WSC", address: "Marszałkowska 3/5", purpose: "", bring: [] } }, "en").findings;
const now = new Date("2026-11-04T10:00:00Z");

describe("watch letter helpers", () => {
  it("sets the reminder to tomorrow 09:00 Warsaw time, across DST", () => {
    expect(tomorrowNine(now)).toBe("2026-11-05T09:00:00+01:00");
    expect(tomorrowNine(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25T09:00:00+01:00");
    expect(tomorrowNine(new Date("2026-10-23T20:00:00Z"))).toBe("2026-10-24T09:00:00+02:00");
    expect(deadlinePatch("ltr_1", now, true).reminders[0]).toEqual({ at: "2026-11-05T09:00:00+01:00", channel: "call", sentAt: null });
  });
  it("is urgent for a deadline within 30 days or an appointment within 14", () => {
    expect(urgency(dl("2026-11-25"), now)).toMatchObject({ urgent: true, dueDate: "2026-11-25" });
    expect(urgency(dl("2027-01-20"), now).urgent).toBe(false);
    expect(urgency(apt("2026-11-12"), now)).toMatchObject({ urgent: true, dueDate: "2026-11-12" });
    expect(urgency(apt("2026-12-01"), now).urgent).toBe(false);
  });
  it("searches only after the baseline, without promotions or chats", () => {
    const q = watchQuery(Date.parse("2026-11-01T08:00:00Z"));
    expect(q.startsWith("after:1793520000 -in:chats -category:promotions -category:social (")).toBe(true);
  });
});

describe("watch state", () => {
  it("lets exactly one concurrent run claim a message or hold the account lock", async () => {
    const env = freshLocalEnv();
    await ensureAccount(env, "a1", 1000);
    const locks = await Promise.all([lockAccount(env, "a1", 5000), lockAccount(env, "a1", 5000)]);
    expect(locks.filter(Boolean)).toHaveLength(1);
    const claims = await Promise.all([claimMessage(env, "a1", "m1", 5000), claimMessage(env, "a1", "m1", 5000)]);
    expect(claims.filter((c) => c !== null)).toEqual([1]);
  });
  it("keeps the first baseline", async () => {
    const env = freshLocalEnv();
    await ensureAccount(env, "a2", 1000);
    expect((await ensureAccount(env, "a2", 9000)).since).toBe(1000);
  });
  it("stops retrying a failed message after three attempts", async () => {
    const env = freshLocalEnv();
    expect(await claimMessage(env, "a3", "m1", 1)).toBe(1);
    for (const attempt of [2, 3]) {
      await env.DB.prepare("UPDATE watch_messages SET status = 'failed' WHERE message_id = 'm1'").run();
      expect(await claimMessage(env, "a3", "m1", 1)).toBe(attempt);
    }
    await env.DB.prepare("UPDATE watch_messages SET status = 'failed' WHERE message_id = 'm1'").run();
    expect(await claimMessage(env, "a3", "m1", 1)).toBeNull();
  });
});
