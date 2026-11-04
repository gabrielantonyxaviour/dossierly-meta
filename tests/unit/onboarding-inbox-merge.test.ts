import { describe, expect, it } from "vitest";
import { extractionSchema } from "@/lib/onboarding/extract";
import { buildFindings, docIdFor, legalBasisLabel, type Finding } from "@/lib/onboarding/findings";
import type { MessageBody } from "@/lib/onboarding/inbox";
import { mergeDocuments } from "@/lib/onboarding/merge";

const msg = (id: string, subject: string, attachments: MessageBody["attachments"] = []): MessageBody => ({
  id, from: "Mazowiecki Urząd Wojewódzki <wsc@example.pl>", subject, receivedAt: "2026-11-04T08:15:00.000Z", text: "", images: [], attachments,
});
const read = (m: MessageBody, x: unknown) => buildFindings(m, extractionSchema.parse(x), "en").findings;
const base = { relevant: true, category: "other", sender: "", summary: "", facts: {}, appointment: null, deadline: null, tasks: [] };

const summons = read(msg("m1summons", "Wezwanie do uzupełnienia braków formalnych wniosku"), {
  ...base, category: "summons",
  deadline: { title: "Reply to the summons", days: 14, from: "delivery", letterDate: "2026-10-22", statedDate: null, quote: "w terminie 14 dni od dnia doręczenia", consequence: "Left unexamined" },
  documents: [
    { title: "Lease", kind: "rental_agreement", status: "requested", attachment: null },
    { title: "Health insurance for the whole stay", kind: "health_insurance", status: "requested", attachment: null },
    { title: "New photo meeting the requirements", kind: "photo", status: "requested", attachment: null },
  ],
});
const lease = read(msg("m2lease", "Umowa najmu – Grzybowska 43A", [{ id: "att-lease-1", name: "umowa_najmu.pdf", mime: "application/pdf", size: 180_000 }]), {
  ...base, addresses: { application: null, current: "ul. Grzybowska 43A m. 12, 00-855 Warszawa", currentFrom: "2026-10-01" },
  documents: [{ title: "Lease agreement", kind: "rental_agreement", status: "have", attachment: "umowa_najmu.pdf" }],
});
const nfz = read(msg("m3nfz", "Potwierdzenie ubezpieczenia NFZ", [{ id: "att-nfz-1", name: "nfz.pdf", mime: "application/pdf", size: 90_000 }]), {
  ...base, documents: [{ title: "NFZ student health insurance", kind: "health_insurance", status: "have", attachment: null }],
});
const mos = read(msg("m4mos", "MOS: potwierdzenie złożenia wniosku"), {
  ...base, facts: { caseNumber: "WSC-II-P.6151.48213.2026", office: "Mazowiecki Urząd Wojewódzki", filedAt: "2026-09-18", mosStatus: null, inpolStatus: null },
  addresses: { application: "DS Babilon, ul. Kickiego 12, 04-369 Warszawa", current: null, currentFrom: null }, documents: [],
});

describe("inbox findings across emails", () => {
  it("keeps one document per kind, prefers the copy from the inbox and marks the rest missing", () => {
    const docs = mergeDocuments([...summons, ...lease, ...nfz, ...mos] as Finding[]);
    const by = Object.fromEntries(docs.map((d) => [d.docKind, d]));
    expect(by.rental_agreement).toMatchObject({ id: docIdFor("rental_agreement"), status: "have", file: { attachmentId: "att-lease-1", mime: "application/pdf" } });
    expect(by.rental_agreement.fields).toMatchObject({ address: "ul. Grzybowska 43A m. 12, 00-855 Warszawa", startDate: "2026-10-01", requestedBy: expect.stringContaining("Wezwanie") });
    expect(by.health_insurance).toMatchObject({ status: "have", file: { attachmentId: "att-nfz-1" } });
    expect(by.photo).toMatchObject({ status: "missing", title: "New photo meeting the requirements" });
    expect(by.upo.fields).toEqual({ applicationAddress: "DS Babilon, ul. Kickiego 12, 04-369 Warszawa" });
  });

  it("counts the summons deadline from the day the email arrived, under its legal basis", () => {
    const d = summons.find((f) => f.kind === "deadline");
    if (!d || d.kind !== "deadline") throw new Error("no deadline");
    expect(d.dueDate).toBe("2026-11-18");
    expect(d.rule).toBe("KPA art. 64 § 2");
    expect(d.days).toBe(14);
    expect(d.steps.join(" ")).toMatch(/art\. 57 § 1.*art\. 57 § 4.*art\. 57 § 5/);
  });

  it("names the cited provision the way the case shows it", () => {
    expect(legalBasisLabel("art. 64 § 2 Kodeksu postępowania administracyjnego")).toBe("KPA art. 64 § 2");
    expect(legalBasisLabel("art. 64 §2 k.p.a.")).toBe("KPA art. 64 § 2");
    expect(legalBasisLabel("art. 108 ust. 1 ustawy o cudzoziemcach")).toBe("art. 108 ust. 1 ustawy o cudzoziemcach");
    expect(legalBasisLabel(null)).toBeNull();
  });

  it("never attaches a file to a document the office only asked for", () => {
    const withFile = read(msg("m5", "Wezwanie", [{ id: "a1", name: "wezwanie.pdf", mime: "application/pdf", size: 1000 }]), { ...base, documents: [{ title: "Lease", kind: "rental_agreement", status: "requested", attachment: "wezwanie.pdf" }] });
    expect(withFile[0]).toMatchObject({ kind: "document", file: null });
  });
});
