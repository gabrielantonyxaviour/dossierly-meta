import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ items: new Map<string, Record<string, unknown>>(), puts: [] as string[] }));
vi.mock("@/lib/case/client", async (orig) => {
  const real = await orig<typeof import("@/lib/case/client")>();
  return {
    ...real,
    caseClient: () => ({
      snapshot: async () => ({ profile: { phone: { callsEnabled: true, verified: true }, city: "Warsaw" }, documents: [...store.items.values()].filter((x) => x.kind && String(x.id).startsWith("doc_")) }),
      create: async (kind: string, item: Record<string, unknown>) => {
        const key = `${kind}:${item.id}`;
        if (store.items.has(key)) throw new real.CaseClientError(409, "exists");
        store.items.set(key, item);
        return item;
      },
      patch: async (kind: string, id: string, patch: Record<string, unknown>) => {
        const key = `${kind}:${id}`;
        const next = { ...store.items.get(key), ...patch, id };
        store.items.set(key, next);
        return next;
      },
      patchFacts: async () => ({}),
      patchProfile: async () => ({}),
    }),
  };
});
vi.mock("@/lib/server/connections/store", async (orig) => ({ ...(await orig<object>()), owned: async () => ({ provider: "gmail" }), rowFor: async () => ({ provider: "googlecalendar" }) }));
const created = vi.hoisted(() => [] as { title: string; date: string }[]);
vi.mock("@/lib/server/connections/calendar", async (orig) => ({
  ...(await orig<object>()),
  calendars: async () => [{ id: "primary", primary: true }],
  createEvent: async (_env: unknown, _account: string, input: { title: string; date: string }) => { created.push(input); return { replayed: false, event: { url: "https://calendar.google.com/x" } }; },
}));
vi.mock("@/lib/server/connections/mail", async (orig) => ({
  ...(await orig<object>()),
  // Each read hands out fresh attachment ids, as Gmail does.
  importGmail: async (_env: unknown, _row: unknown, messageId: string, attachmentId?: string) => {
    if (attachmentId) return { kind: "attachment", file: { name: "x.pdf", mime: "application/pdf", dataUrl: `data:application/pdf;base64,${btoa("%PDF-1.7")}` } };
    const files: Record<string, { name: string; mime: string; size: number }[]> = {
      m1summons: [{ name: "logo.png", mime: "image/png", size: 900 }, { name: "wezwanie.pdf", mime: "application/pdf", size: 120_000 }],
      m2lease: [{ name: "umowa_najmu.pdf", mime: "application/pdf", size: 180_000 }],
    };
    return { kind: "message", messageId, subject: "", from: "", text: "", attachments: (files[messageId] ?? []).map((f) => ({ ...f, id: `fresh-${Math.random()}` })) };
  },
}));

import { commitFindings, letterIdFor } from "@/lib/onboarding/commit";
import { extractionSchema } from "@/lib/onboarding/extract";
import { buildFindings, docIdFor, type Finding } from "@/lib/onboarding/findings";
import type { MessageBody } from "@/lib/onboarding/inbox";

const msg = (id: string, subject: string, attachments: MessageBody["attachments"] = []): MessageBody => ({
  id, from: "Wydział Spraw Cudzoziemców <wsc@example.pl>", subject, receivedAt: "2026-11-04T23:02:40.000Z", text: "", images: [], attachments,
});
const read = (m: MessageBody, x: unknown) => buildFindings(m, extractionSchema.parse(x), "en").findings;
const base = { relevant: true, category: "other", sender: "", summary: "", facts: {}, appointment: null, deadline: null, tasks: [] };
const subject = "Wezwanie do uzupełnienia braków formalnych wniosku — WSC-II-P.6151.48213.2026";
const findings = [
  ...read(msg("m1summons", subject, [{ id: "att-w-1", name: "wezwanie.pdf", mime: "application/pdf", size: 120_000 }]), {
    ...base, category: "summons",
    deadline: { title: "Reply to the summons", days: 14, from: "delivery", letterDate: "2026-10-22", statedDate: null, quote: "w terminie 14 dni od dnia doręczenia", consequence: "Left unexamined", legalBasis: "art. 64 § 2 Kodeksu postępowania administracyjnego" },
    documents: [
      { title: "Lease", kind: "rental_agreement", status: "requested", attachment: null },
      { title: "New photo meeting the requirements", kind: "photo", status: "requested", attachment: null },
    ],
  }),
  ...read(msg("m2lease", "Umowa najmu – Grzybowska 43A m. 12", [{ id: "att-lease-1", name: "umowa_najmu.pdf", mime: "application/pdf", size: 180_000 }]), {
    ...base, documents: [{ title: "Lease", kind: "rental_agreement", status: "have", attachment: "umowa_najmu.pdf" }],
  }),
] as Finding[];

const env = { BLOBS: { put: async (k: string) => { store.puts.push(k); }, get: async () => null, delete: async () => undefined } } as never;
const ids = { userId: "u1", accountId: "u1" };

describe("onboarding commit saves the summons as a letter", () => {
  beforeEach(() => { store.items.clear(); store.puts.length = 0; created.length = 0; });

  it("stores the letter's PDF, lists what it asks for and points the deadline at it", async () => {
    await commitFindings(env, ids, { findings, summaries: [], addToCalendar: false });
    const id = letterIdFor("m1summons");
    const letter = store.items.get(`documents:${id}`);
    expect(letter).toMatchObject({ kind: "letter", source: "email", status: "have", title: "Summons to complete the application", fileKey: `case/u1/documents/${id}.pdf` });
    expect((letter?.extractedFields as Record<string, string>).asks).toMatch(/Lease.*New photo/);
    const deadline = [...store.items.entries()].find(([k]) => k.startsWith("deadlines:"))?.[1];
    expect(deadline).toMatchObject({ triggeredBy: id, computation: { rule: "KPA art. 64 § 2" } });
    // The lease file is found again by name although Gmail re-issued its id.
    expect(store.items.get(`documents:${docIdFor("rental_agreement")}`)).toMatchObject({ status: "have", fileKey: `case/u1/documents/${docIdFor("rental_agreement")}.pdf` });
  });

  it("is idempotent: a second save updates the same letter and deadline", async () => {
    await commitFindings(env, ids, { findings, summaries: [], addToCalendar: false });
    const before = store.items.size;
    await commitFindings(env, ids, { findings, summaries: [], addToCalendar: false });
    expect(store.items.size).toBe(before);
    expect([...store.items.keys()].filter((k) => k.startsWith("documents:doc_ltr_"))).toHaveLength(1);
  });

  it("the separate calendar step only adds the dates to Google Calendar and notes it, without re-saving the case", async () => {
    const r = await commitFindings(env, ids, { findings, summaries: [], addToCalendar: true, calendarOnly: true });
    expect(r.saved).toBe(0);
    expect(r.calendar).toEqual([expect.objectContaining({ status: "added", title: "Deadline: Reply to the summons" })]);
    expect(created).toHaveLength(1);
    const kinds = [...store.items.keys()].map((k) => k.split(":")[0]);
    expect(kinds).toEqual(["events"]);
    expect(store.puts).toHaveLength(0);
  });
});
