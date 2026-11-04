import { describe, expect, it } from "vitest";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { ADDRESS_INTENT, addressChange, askedDocs } from "@/lib/voice/server/modes/counter-lanes";
import { letterReason } from "@/lib/voice/server/twilio";
import type { CaseSnapshot } from "@/lib/case/types";

const seed = buildArjunSeed("2026-11-04");
const snap = { ...seed, documents: seed.documents.map((d) => ({ ...d, fileKey: null, pages: d.pages ?? null, createdAt: "2026-11-04T08:00:00+01:00" })) } as unknown as CaseSnapshot;

describe("counter: instant document match", () => {
  it("pulls up the lease from 'Umowa najmu?' and the passport in any case ending", () => {
    expect(askedDocs("Umowa najmu?", snap.documents).map((d) => d.id)).toEqual(["doc-rental"]);
    expect(askedDocs("Poproszę paszport i umowę najmu", snap.documents).map((d) => d.id)).toEqual(["doc-passport", "doc-rental"]);
  });
  it("ignores turns that name no document", () => {
    expect(askedDocs("Moment... Tu jest inny adres niż we wniosku. Dlaczego?", snap.documents)).toEqual([]);
    expect(askedDocs("Dobrze. Teraz odciski.", snap.documents)).toEqual([]);
  });
});

describe("counter: address change facts", () => {
  it("finds the dorm on the application and the flat on the lease", () => {
    expect(addressChange(snap)).toEqual({
      oldAddress: "DS Babilon, ul. Kickiego 12, 04-369 Warszawa",
      newAddress: "ul. Grzybowska 43A m. 12, 00-855 Warszawa",
      movedOn: "2026-10-01",
      caseNumber: "WSC-II-P.6151.48213.2026",
    });
  });
  it("returns null when the addresses match", () => {
    const same = { ...snap, documents: snap.documents.map((d) => (d.id === "doc-rental" ? { ...d, extractedFields: { address: "DS Babilon, ul. Kickiego 12, 04-369 Warszawa", startDate: "2026-09-01" } } : d)) };
    expect(addressChange(same)).toBeNull();
  });
  it("hears the intent in Arjun's reply", () => {
    expect(ADDRESS_INTENT.test("I moved out of the dorm on the first of October. I'd like to update my address today.")).toBe(true);
    expect(ADDRESS_INTENT.test("Yes, here is my passport.")).toBe(false);
  });
});

describe("phone call reason", () => {
  it("carries the deadline id, drafts and tomorrow-at-nine reminder", () => {
    const r = letterReason(
      { title: "Wezwanie: zaświadczenie o studiach", sender: "Mazowiecki Urząd Wojewódzki", asks: "a certificate of enrolment", dueDate: "2026-11-25", deadlineId: "dl_enrol", draftIds: ["doc_dean"], prepared: ["Request to your dean's office (draft)"] },
      new Date("2026-11-04T17:30:00Z"),
    );
    expect(r).toContain("Wednesday 25 November 2026 (2026-11-25) (#dl_enrol)");
    expect(r).toContain("Thursday 5 November 2026");
    expect(r).toContain("#doc_dean");
    expect(r).toContain("REMIND: dl_enrol | 2026-11-05 09:00");
  });
});
