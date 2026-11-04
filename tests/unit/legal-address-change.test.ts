import { describe, expect, it } from "vitest";
import { handleCaseRequest } from "@/lib/case/handler";
import { memorySql } from "@/lib/case/memory-sql";
import { CaseStore } from "@/lib/case/store";
import type { CaseSnapshot } from "@/lib/case/types";
import { buildAddressChange, draftAddressChange } from "@/lib/legal/address-change";
import { quote } from "@/lib/legal/articles";

const DORM = "DS Babilon, ul. Kickiego 12, 04-369 Warszawa";
const FLAT = "ul. Grzybowska 43A m. 12, 00-855 Warszawa";
const CASE_NO = "WSC-II-P.6151.48213.2026";

function setup() {
  const store = new CaseStore(memorySql());
  const stub = { fetch: (input: string | Request, init?: RequestInit) => handleCaseRequest(store, new Request(input, init)) };
  const env = { CASE_DO: { idFromName: (n: string) => n, get: () => stub } };
  store.patchProfile({ fullName: "Arjun Raman", permitType: "temporary_residence_study", city: "Warsaw" });
  store.patchFacts({ filedAt: { value: "2026-09-18", source: { type: "email", ref: null }, confirmedByUser: true } });
  store.create("documents", { kind: "rental_agreement", title: "Lease", extractedFields: { address: FLAT, startDate: "2026-10-01" } });
  return { store, env };
}
const input = (snapshot: CaseSnapshot) => ({ userId: "u_arjun", snapshot, oldAddress: DORM, newAddress: FLAT, movedOn: "2026-10-01", caseNumber: CASE_NO, today: "2026-11-04" });

describe("buildAddressChange", () => {
  it("drafts the KPA art. 41 notice from the case", () => {
    const { store } = setup();
    const d = buildAddressChange(input(store.snapshot()));
    expect(d.textPl).toContain("Warszawa, dnia 4 listopada 2026 r.");
    expect(d.textPl).toContain(`Znak sprawy: ${CASE_NO}`);
    expect(d.textPl).toContain("ZAWIADOMIENIE O ZMIANIE ADRESU");
    expect(d.textPl).toContain("art. 41 § 1 Kodeksu postępowania administracyjnego");
    expect(d.textPl).toContain("w celu kontynuacji studiów (wniosek z dnia 18 września 2026 r.)");
    expect(d.textPl).toContain(`Dotychczasowy adres (podany we wniosku): ${DORM}.`);
    expect(d.textPl).toContain(`od dnia 1 października 2026 r.: ${FLAT}.`);
    expect(d.textPl).toContain("Załącznik: umowa najmu");
    expect(d.fields.textEn).toContain(quote("kpa41", "2"));
    expect(d.fields.basis).toBe("KPA art. 41 §1");
  });

  it("leaves out the lease line when there is no lease, and rejects bad dates", () => {
    const store = new CaseStore(memorySql());
    const snap = store.snapshot();
    expect(buildAddressChange({ ...input(snap) }).textPl).not.toContain("Załącznik");
    expect(() => buildAddressChange({ ...input(snap), movedOn: "1 Oct" })).toThrow();
  });
});

describe("draftAddressChange", () => {
  it("saves one agent letter document and stays idempotent", async () => {
    const { store, env } = setup();
    const a = await draftAddressChange(env, input(store.snapshot()));
    const b = await draftAddressChange(env, input(store.snapshot()));
    expect(a.docId).toBe(b.docId);
    const docs = store.snapshot().documents.filter((d) => d.id === a.docId);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ kind: "letter", status: "have", source: "agent" });
    const saved = Object.keys(docs[0].extractedFields).filter((k) => /^text\d*$/.test(k)).sort().map((k) => docs[0].extractedFields[k]).join("");
    expect(saved).toBe(a.textPl);
    expect(store.snapshot().events.some((e) => e.refs.includes(a.docId))).toBe(true);
  });

  it("fails clearly without the case binding", async () => {
    const { store } = setup();
    await expect(draftAddressChange({}, input(store.snapshot()))).rejects.toThrow(/unavailable/);
  });
});
