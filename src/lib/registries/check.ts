import { getEnv } from "@/lib/server/env";
import { longDate, normalizeKrs, normalizeNip, warsawToday } from "./ids";
import { KRS_URL, lookupKrs, lookupVat, WL_URL } from "./sources";
import type { FetchLike, RegistryResult, Verdict } from "./types";

const CACHE_TTL = 60 * 60 * 24;
const WL_SOURCE = { label: "Ministry of Finance VAT white list (Biała lista)", url: "https://www.podatki.gov.pl/wykaz-podmiotow-zarejestrowanych-jako-podatnicy-vat-niezarejestrowanych-i-wykreslonych-i-przywroconych-do-rejestru-vat/" };
const KRS_SOURCE = { label: "National Court Register (KRS)", url: "https://wyszukiwarka-krs.ms.gov.pl/" };

export interface CheckDeps { fetch?: FetchLike; now?: Date; cache?: boolean }

const VAT_LINES: Record<string, string> = {
  Czynny: "registered as an active VAT payer (Czynny)",
  Zwolniony: "registered but exempt from VAT (Zwolniony)",
  Niezarejestrowany: "not registered as a VAT payer (Niezarejestrowany)",
};

export function buildVerdict(r: Pick<RegistryResult, "vat" | "krs">, down: boolean, now: Date): Verdict {
  const checkedAt = now.toISOString();
  const day = longDate(checkedAt);
  const lines: string[] = [];
  const sources: Verdict["sources"] = [];
  if (r.vat) {
    sources.push({ ...WL_SOURCE, url: r.vat.nip ? WL_URL(r.vat.nip, warsawToday(now)) : WL_SOURCE.url });
    const phrase = VAT_LINES[r.vat.statusVat ?? ""] ?? `listed with VAT status "${r.vat.statusVat ?? "unknown"}"`;
    lines.push(`${r.vat.name}: ${phrase} on the Ministry of Finance white list, checked ${day}.`);
    if (r.vat.registrationLegalDate) lines.push(`VAT-registered since ${longDate(r.vat.registrationLegalDate)}; ${r.vat.accountCount} bank account${r.vat.accountCount === 1 ? "" : "s"} on the list.`);
  }
  if (r.krs) {
    sources.push({ ...KRS_SOURCE, url: KRS_URL(r.krs.krsNumber, "P") });
    lines.push(`Found in the National Court Register (KRS ${r.krs.krsNumber})${r.krs.legalForm ? ` as a ${r.krs.legalForm.toLowerCase()}` : ""}${r.krs.seat ? `, seat in ${r.krs.seat}` : ""}.`);
  } else if (r.vat) {
    lines.push("Not found in the KRS company register. Public universities and other public bodies are normally outside KRS, so this alone is not a warning sign.");
  }
  if (down) lines.push("One registry did not respond in time, so this result may be incomplete.");
  const vatOk = r.vat?.statusVat === "Czynny" || r.vat?.statusVat === "Zwolniony";
  let status: Verdict["status"];
  if (r.vat || r.krs) status = vatOk || (!r.vat && r.krs) ? "active" : "inactive";
  else status = down ? "unavailable" : "not_found";
  if (status === "inactive") lines.push("This entity is not an active VAT payer. Ask the employer or university to explain before relying on them for your permit application.");
  if (status === "not_found") lines.push("No matching entry was found. Check the number against the employer's contract or letterhead.");
  if (status === "unavailable") lines.push("The official registries could not be reached. Try again in a few minutes.");
  return { status, lines, checkedAt, sources };
}

async function run(nip: string | null, krsIn: string | null, f: FetchLike, now: Date): Promise<RegistryResult> {
  const date = warsawToday(now);
  let down = false;
  let vat = nip ? await lookupVat(f, nip, date) : null;
  let krs = krsIn ? await lookupKrs(f, krsIn) : null;
  // Chain: a NIP result may carry a KRS number, a KRS result a NIP.
  if (vat?.state === "found" && !krs && vat.data.krs) krs = await lookupKrs(f, vat.data.krs);
  if (krs?.state === "found" && !vat && krs.data.nip && normalizeNip(krs.data.nip)) vat = await lookupVat(f, krs.data.nip, date);
  for (const l of [vat, krs]) if (l?.state === "down") down = true;
  const vatData = vat?.state === "found" ? vat.data : null;
  const krsData = krs?.state === "found" ? krs.data : null;
  const krsOut = krsData ? (({ nip: _nip, ...rest }) => rest)(krsData) : null;
  return {
    query: { nip: nip ?? vatData?.nip ?? krsData?.nip ?? null, krs: krsIn ?? krsData?.krsNumber ?? null },
    vat: vatData, krs: krsOut, verdict: buildVerdict({ vat: vatData, krs: krsOut }, down, now),
  };
}

/** Looks up an employer or university by NIP or KRS; cached 24 h per query when KV is available. */
export async function checkRegistry(input: { nip?: string; krs?: string }, deps: CheckDeps = {}): Promise<RegistryResult> {
  const nip = input.nip ? normalizeNip(input.nip) : null;
  const krs = input.krs ? normalizeKrs(input.krs) : null;
  if (!nip && !krs) throw new Error("checkRegistry needs a valid nip or krs");
  const key = nip ? `registry:nip:${nip}` : `registry:krs:${krs}`;
  const useCache = deps.cache !== false;
  if (useCache) {
    try {
      const hit = await getEnv().CACHE.get(key);
      if (hit) return JSON.parse(hit) as RegistryResult;
    } catch { /* cache is best effort */ }
  }
  const result = await run(nip, krs, deps.fetch ?? ((u, i) => fetch(u, i)), deps.now ?? new Date());
  if (useCache && result.verdict.status !== "unavailable") {
    try { await getEnv().CACHE.put(key, JSON.stringify(result), { expirationTtl: CACHE_TTL }); } catch { /* ignore */ }
  }
  return result;
}
