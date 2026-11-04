import { describe, expect, it } from "vitest";
import { checkRegistry } from "@/lib/registries/check";
import { checkQuerySchema, normalizeKrs, normalizeNip, warsawToday } from "@/lib/registries/ids";

const NOW = new Date("2026-11-04T09:00:00Z");
const wl = (over: object = {}) => ({
  result: { subject: { name: "ORANGE POLSKA SPÓŁKA AKCYJNA", nip: "5260250995", statusVat: "Czynny", regon: "012100784", krs: "0000010681", residenceAddress: "ALEJE JEROZOLIMSKIE 160, 02-326 WARSZAWA", registrationLegalDate: "1996-01-01", accountNumbers: ["1", "2"], ...over }, requestId: "abc-123" },
});
const krsBody = {
  odpis: {
    naglowekA: { numerKRS: "0000010681", dataRejestracjiWKRS: "02.05.2001" },
    dane: {
      dzial1: { danePodmiotu: { nazwa: "ORANGE POLSKA SPÓŁKA AKCYJNA", formaPrawna: "SPÓŁKA AKCYJNA", identyfikatory: { nip: "5260250995" } }, siedzibaIAdres: { siedziba: { miejscowosc: "WARSZAWA", wojewodztwo: "MAZOWIECKIE" }, adres: { ulica: "AL. JEROZOLIMSKIE", nrDomu: "160", kodPocztowy: "02-326", miejscowosc: "WARSZAWA" } } },
      dzial2: { reprezentacja: { sklad: [{ nazwisko: { nazwiskoICzlon: "K*****" }, imiona: { imie: "J****" }, funkcjaWOrganie: "CZŁONEK ZARZĄDU" }] } },
    },
  },
};
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("identifiers", () => {
  it("validates NIP checksum and tolerates separators", () => {
    expect(normalizeNip("526-025-09-95")).toBe("5260250995");
    expect(normalizeNip("526 025 0995")).toBe("5260250995");
    expect(normalizeNip("5260250994")).toBeNull();
    expect(normalizeNip("12345")).toBeNull();
  });
  it("left-pads KRS", () => {
    expect(normalizeKrs("10681")).toBe("0000010681");
    expect(normalizeKrs("abc")).toBeNull();
    expect(normalizeKrs("12345678901")).toBeNull();
  });
  it("requires exactly one valid identifier", () => {
    expect(checkQuerySchema.safeParse({}).success).toBe(false);
    expect(checkQuerySchema.safeParse({ nip: "5260250995", krs: "1" }).success).toBe(false);
    expect(checkQuerySchema.safeParse({ nip: "1234567890" }).success).toBe(false);
    expect(checkQuerySchema.safeParse({ krs: "10681" }).success).toBe(true);
  });
  it("uses the Warsaw calendar day", () => {
    expect(warsawToday(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
  });
});

describe("checkRegistry", () => {
  it("combines the white list and KRS, calling the dated WL url", async () => {
    const urls: string[] = [];
    const fetch = async (u: string) => {
      urls.push(u);
      return u.includes("wl-api") ? res(wl()) : res(krsBody);
    };
    const r = await checkRegistry({ nip: "526-025-09-95" }, { fetch, now: NOW, cache: false });
    expect(urls[0]).toBe("https://wl-api.mf.gov.pl/api/search/nip/5260250995?date=2026-11-04");
    expect(r.verdict.status).toBe("active");
    expect(r.vat).toMatchObject({ statusVat: "Czynny", accountCount: 2, requestId: "abc-123" });
    expect(r.krs).toMatchObject({ krsNumber: "0000010681", registeredAt: "2001-05-02", legalForm: "SPÓŁKA AKCYJNA" });
    expect(r.krs?.board).toEqual(["J**** K***** (członek zarządu)"]);
    expect(r.verdict.lines[0]).toContain("Czynny");
    expect(r.verdict.lines[0]).toContain("4 Nov 2026");
    expect(r.verdict.sources).toHaveLength(2);
  });

  it("handles a public body without KRS", async () => {
    const fetch = async () => res(wl({ name: "POLITECHNIKA WARSZAWSKA", krs: null }));
    const r = await checkRegistry({ nip: "5260250995" }, { fetch, now: NOW, cache: false });
    expect(r.krs).toBeNull();
    expect(r.verdict.status).toBe("active");
    expect(r.verdict.lines.join(" ")).toContain("Public universities");
  });

  it("marks a non-registered VAT subject inactive", async () => {
    const fetch = async () => res(wl({ statusVat: "Niezarejestrowany", krs: null }));
    const r = await checkRegistry({ nip: "5260250995" }, { fetch, now: NOW, cache: false });
    expect(r.verdict.status).toBe("inactive");
  });

  it("returns not_found when WL has no subject and KRS 404s", async () => {
    const fetch = async (u: string) => (u.includes("wl-api") ? res({ result: { subject: null } }) : res({}, 404));
    expect((await checkRegistry({ nip: "5260250995" }, { fetch, now: NOW, cache: false })).verdict.status).toBe("not_found");
    expect((await checkRegistry({ krs: "99" }, { fetch, now: NOW, cache: false })).verdict.status).toBe("not_found");
  });

  it("returns unavailable on timeouts or 5xx, and does not cache it", async () => {
    const boom = async () => { throw new Error("timeout"); };
    expect((await checkRegistry({ nip: "5260250995" }, { fetch: boom, now: NOW })).verdict.status).toBe("unavailable");
    const five = async () => res({}, 503);
    expect((await checkRegistry({ krs: "10681" }, { fetch: five, now: NOW })).verdict.status).toBe("unavailable");
    let calls = 0;
    const ok = async () => { calls++; return res(wl({ krs: null })); };
    expect((await checkRegistry({ nip: "5260250995" }, { fetch: ok, now: NOW })).verdict.status).toBe("active");
  });

  it("serves the second identical query from cache", async () => {
    let calls = 0;
    const fetch = async () => { calls++; return res(wl({ krs: null, nip: "5250008066" })); };
    await checkRegistry({ nip: "7740001454" }, { fetch, now: NOW });
    const first = calls;
    await checkRegistry({ nip: "7740001454" }, { fetch, now: NOW });
    expect(calls).toBe(first);
  });
});
