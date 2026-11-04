import type { FetchLike, KrsInfo, VatInfo } from "./types";

const TIMEOUT_MS = 8000;
export const WL_URL = (nip: string, date: string) => `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${date}`;
export const KRS_URL = (krs: string, reg: "P" | "S") => `https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${krs}?rejestr=${reg}&format=json`;

/** "found" with data, "none" when the registry has no such entry, "down" on timeout or server failure. */
export type Lookup<T> = { state: "found"; data: T; url: string } | { state: "none" } | { state: "down" };

async function getJson(f: FetchLike, url: string): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await f(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null;
  }
}

type Rec = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});

export async function lookupVat(f: FetchLike, nip: string, date: string): Promise<Lookup<VatInfo>> {
  const url = WL_URL(nip, date);
  const r = await getJson(f, url);
  if (!r || r.status >= 500 || r.status === 429) return { state: "down" };
  const result = rec(rec(r.body).result);
  const subject = rec(result.subject);
  if (!str(subject.nip)) {
    // WL-115 / WL-112 style codes mean "not a valid or known NIP"; other errors are treated as outages.
    const code = str(rec(r.body).code);
    return r.status === 200 || code === "WL-115" || code === "WL-112" ? { state: "none" } : { state: "down" };
  }
  const accounts = Array.isArray(subject.accountNumbers) ? subject.accountNumbers.length : 0;
  return {
    state: "found", url,
    data: {
      name: str(subject.name) ?? "", nip: str(subject.nip) ?? nip, regon: str(subject.regon), krs: str(subject.krs),
      statusVat: str(subject.statusVat), address: str(subject.residenceAddress) ?? str(subject.workingAddress),
      registrationLegalDate: str(subject.registrationLegalDate), accountCount: accounts, requestId: str(result.requestId),
    },
  };
}

function joinAddress(a: Rec): string | null {
  const street = [str(a.ulica), str(a.nrDomu)].filter(Boolean).join(" ") + (str(a.nrLokalu) ? `/${str(a.nrLokalu)}` : "");
  const city = [str(a.kodPocztowy), str(a.miejscowosc)].filter(Boolean).join(" ");
  return [street.trim(), city].filter(Boolean).join(", ") || null;
}

function boardOf(dzial2: Rec): string[] {
  const out: string[] = [];
  const person = (p: Rec, role: string | null) => {
    const surname = str(rec(p.nazwisko).nazwiskoICzlon);
    const given = str(rec(p.imiona).imie);
    const name = [given, surname].filter(Boolean).join(" ");
    if (name) out.push(role ? `${name} (${role.toLowerCase()})` : name);
  };
  const rep = rec(dzial2.reprezentacja);
  for (const p of Array.isArray(rep.sklad) ? rep.sklad : []) person(rec(p), str(rec(p).funkcjaWOrganie));
  return out.slice(0, 6);
}

function ddmmyyyyToIso(s: string | null): string | null {
  const m = s?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export async function lookupKrs(f: FetchLike, krs: string): Promise<Lookup<KrsInfo>> {
  let sawNone = false;
  for (const reg of ["P", "S"] as const) {
    const url = KRS_URL(krs, reg);
    const r = await getJson(f, url);
    if (!r || r.status >= 500 || r.status === 429) return { state: "down" };
    const odpis = rec(rec(r.body).odpis);
    const dane = rec(odpis.dane);
    const d1 = rec(dane.dzial1);
    const subject = rec(d1.danePodmiotu);
    if (r.status !== 200 || !str(subject.nazwa)) {
      if (r.status === 404 || r.status === 200 || r.status === 400) { sawNone = true; continue; }
      return { state: "down" };
    }
    const seat = rec(rec(d1.siedzibaIAdres).siedziba);
    return {
      state: "found", url,
      data: {
        name: str(subject.nazwa) ?? "", legalForm: str(subject.formaPrawna),
        seat: [str(seat.miejscowosc), str(seat.wojewodztwo)].filter(Boolean).join(", ") || null,
        address: joinAddress(rec(rec(d1.siedzibaIAdres).adres)),
        registeredAt: ddmmyyyyToIso(str(rec(odpis.naglowekA).dataRejestracjiWKRS)),
        board: boardOf(rec(dane.dzial2)), krsNumber: str(rec(odpis.naglowekA).numerKRS) ?? krs,
        nip: str(rec(subject.identyfikatory).nip),
      },
    };
  }
  return sawNone ? { state: "none" } : { state: "down" };
}
