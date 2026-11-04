/*
 * "Zawiadomienie o zmianie adresu" (KPA art. 41) drafted from the case, for the Counter and anywhere else.
 * Deterministic template, no model call: it returns in one case-store write. The legal basis is quoted
 * verbatim from articles.ts. Callable from VoiceDO: it talks to env.CASE_DO directly, not through Next.
 */
import type { CaseSnapshot } from "../case/types";
import { articleLabel, quote } from "./articles";

type Stub = { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
export type AddressChangeEnv = { CASE_DO?: { idFromName(name: string): unknown; get(id: unknown): Stub } } & Record<string, unknown>;

export interface AddressChangeInput {
  userId: string;
  snapshot: CaseSnapshot;
  oldAddress: string;
  newAddress: string;
  /** YYYY-MM-DD, the day the person moved (lease start). */
  movedOn: string;
  caseNumber: string;
  /** YYYY-MM-DD letter date; defaults to today in Europe/Warsaw. */
  today?: string;
}

export interface AddressChangeDraft {
  docId: string;
  title: string;
  textPl: string;
  /** textEn (English gloss), oldAddress, newAddress, movedOn, caseNumber, basis, date. */
  fields: Record<string, string>;
}

const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const plDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)} r.`;
const enDate = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS_EN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
export const warsawDate = (at = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(at);

const PURPOSE: Record<string, string> = {
  temporary_residence_study: "o udzielenie zezwolenia na pobyt czasowy w celu kontynuacji studiów",
  temporary_residence_work: "o udzielenie zezwolenia na pobyt czasowy w celu wykonywania pracy",
};

/** FNV-1a, so the same case and new address always map to the same document. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

/** The letter itself, without saving anything. */
export function buildAddressChange(input: Omit<AddressChangeInput, "userId">): Omit<AddressChangeDraft, "docId"> {
  const { snapshot, movedOn, caseNumber } = input;
  const oldAddress = input.oldAddress.trim();
  const newAddress = input.newAddress.trim();
  const today = input.today ?? warsawDate();
  if (!DATE.test(movedOn) || !DATE.test(today)) throw new Error("Dates must be YYYY-MM-DD");
  if (!oldAddress || !newAddress || !caseNumber.trim()) throw new Error("oldAddress, newAddress and caseNumber are required");

  const name = snapshot.profile.fullName?.trim() || "";
  const filed = snapshot.facts.filedAt?.value;
  const filedPl = filed && DATE.test(filed) ? ` (wniosek z dnia ${plDate(filed)})` : "";
  const purpose = PURPOSE[snapshot.profile.permitType ?? ""] ?? "o udzielenie zezwolenia na pobyt";
  const hasLease = snapshot.documents.some((d) => d.kind === "rental_agreement" && d.status === "have");
  const city = snapshot.profile.city?.trim() || "Warszawa";
  const cityPl = /^warsaw$/i.test(city) ? "Warszawa" : city;

  const textPl = [
    `${cityPl}, dnia ${plDate(today)}`,
    [name, newAddress].filter(Boolean).join("\n"),
    "Wojewoda Mazowiecki\nMazowiecki Urząd Wojewódzki w Warszawie\nWydział Spraw Cudzoziemców",
    `Znak sprawy: ${caseNumber.trim()}`,
    "ZAWIADOMIENIE O ZMIANIE ADRESU",
    `Na podstawie art. 41 § 1 Kodeksu postępowania administracyjnego zawiadamiam o zmianie mojego adresu w toku postępowania w sprawie ${purpose}${filedPl}.`,
    `Dotychczasowy adres (podany we wniosku): ${oldAddress}.`,
    `Nowy adres zamieszkania i adres do doręczeń, od dnia ${plDate(movedOn)}: ${newAddress}.`,
    "Proszę o kierowanie wszelkiej korespondencji w tej sprawie na nowy adres.",
    ...(hasLease ? ["Załącznik: umowa najmu lokalu pod nowym adresem."] : []),
    `${name || "Imię i nazwisko"}\n(podpis)`,
  ].join("\n\n");

  const textEn = [
    "Notice of change of address.",
    `Under KPA art. 41 §1 I notify the office that my address changed while case ${caseNumber.trim()} is pending.`,
    `Previous address (on the application): ${oldAddress}.`,
    `New home and delivery address, from ${enDate(movedOn)}: ${newAddress}.`,
    "Please send all letters in this case to the new address.",
    ...(hasLease ? ["Attached: the lease for the new address."] : []),
    `Until the office has this, letters sent to the old address count as delivered (KPA art. 41 §2: "${quote("kpa41", "2")}").`,
  ].join(" ");

  return {
    title: "Zawiadomienie o zmianie adresu (KPA art. 41), draft",
    textPl,
    fields: {
      textEn,
      oldAddress,
      newAddress,
      movedOn,
      caseNumber: caseNumber.trim(),
      date: today,
      basis: articleLabel("kpa41", "1"),
      basisQuote: quote("kpa41", "1"),
      status: "draft",
    },
  };
}

/** Case-store document fields are capped at 1000 characters; long letters are split across text, text2, ... */
function toExtracted(textPl: string, fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0, n = 1; i < textPl.length; i += 1000, n++) out[n === 1 ? "text" : `text${n}`] = textPl.slice(i, i + 1000);
  for (const [k, v] of Object.entries(fields)) out[k] = v.slice(0, 1000);
  return out;
}

async function call(stub: Stub, path: string, method: string, body: unknown): Promise<Response> {
  return stub.fetch(`https://case.do/${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

/**
 * Drafts the notice and saves it to the case as a letter document (status have, source agent).
 * Idempotent: the same case number and new address update the same document.
 */
export async function draftAddressChange(env: AddressChangeEnv, input: AddressChangeInput): Promise<AddressChangeDraft> {
  const draft = buildAddressChange(input);
  const docId = `doc_addr_${hash(`${draft.fields.caseNumber}|${draft.fields.newAddress.toLowerCase()}`)}`;
  if (!env.CASE_DO) throw new Error("Case storage is unavailable");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(input.userId)) throw new Error("Invalid user");
  const stub = env.CASE_DO.get(env.CASE_DO.idFromName(input.userId));
  const extractedFields = toExtracted(draft.textPl, draft.fields);
  const doc = { kind: "letter", title: draft.title, status: "have", fileKey: null, pages: 1, extractedFields, source: "agent" };

  let res = await call(stub, "documents", "POST", { id: docId, ...doc });
  if (res.status === 409) res = await call(stub, `documents/${docId}`, "PATCH", { title: draft.title, extractedFields, status: "have" });
  if (!res.ok) throw new Error(`Could not save the address-change draft (${res.status})`);
  await call(stub, "events", "POST", {
    id: `evt_addr_${hash(docId)}`, type: "document_added", refs: [docId],
    summary: `Drafted the notice of change of address for case ${draft.fields.caseNumber} (KPA art. 41).`,
  }).catch(() => undefined);
  return { docId, ...draft };
}
