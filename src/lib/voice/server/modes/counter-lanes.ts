/*
 * Counter side lanes that must beat the spoken translation: instant document match on the official's words, the
 * case-aware coach card (Spark 1.3 raced against 1.2), and the facts an address-change notice needs.
 */
import type { CaseDocument, CaseSnapshot } from "../../../case/types";
import type { DocCard } from "../../protocol";
import { streamLines } from "../llm";
import { coachSystem } from "../prompts";
import type { VoiceEnv } from "../session";

/** Polish caption shown to the official for each document kind. */
export const PL_DOC: Record<string, string> = {
  passport: "Paszport", rental_agreement: "Umowa najmu", health_insurance: "Ubezpieczenie zdrowotne",
  university_certificate: "Zaświadczenie z uczelni", photo: "Zdjęcie", upo: "UPO (potwierdzenie złożenia wniosku)", letter: "Pismo", other: "Dokument",
};

const FILE_TYPE: Record<string, "image" | "pdf"> = { png: "image", jpg: "image", jpeg: "image", webp: "image", pdf: "pdf" };

/** The document's own stored file, when it has one the viewer can render. */
export function storedFile(doc: CaseDocument): DocCard["file"] {
  const type = doc.fileKey ? FILE_TYPE[doc.fileKey.split(".").pop()?.toLowerCase() ?? ""] : undefined;
  return type ? { url: `/api/case/documents/${encodeURIComponent(doc.id)}/file`, type } : null;
}

/** How an official names each document kind (stems, so any case ending matches). */
const ASKED: Array<[CaseDocument["kind"], RegExp]> = [
  ["rental_agreement", /\bumow\p{L}* najm\p{L}*|\bnajm\p{L}*\b/iu],
  ["passport", /\bpaszport\p{L}*/iu],
  ["health_insurance", /\bubezpiecze\p{L}*|\bpolis\p{L}*/iu],
  ["university_certificate", /\bzaświadcze\p{L}* z uczelni|\bzaświadcze\p{L}* o studi\p{L}*|\blegitymacj\p{L}*/iu],
  ["photo", /\bzdję\p{L}*|\bfotografi\p{L}*/iu],
  ["upo", /\bUPO\b|\bpotwierdze\p{L}* złożeni\p{L}*/u],
];

/** Documents the official named in these words that the user holds, in the order named. No model call. */
export function askedDocs(text: string, docs: CaseDocument[]): CaseDocument[] {
  const hits = ASKED.map(([kind, re]) => ({ kind, at: text.search(re) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
  const out: CaseDocument[] = [];
  for (const h of hits) {
    const d = docs.find((x) => x.kind === h.kind && x.status === "have") ?? docs.find((x) => x.kind === h.kind);
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

export interface AddressFacts {
  oldAddress: string;
  newAddress: string;
  movedOn: string;
  caseNumber: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\d]+/gu, "");

/** Application address (MOS/UPO) vs the lease address, when the case shows the user moved. */
export function addressChange(c: CaseSnapshot | null): AddressFacts | null {
  if (!c) return null;
  const app = c.documents.find((d) => d.extractedFields.applicationAddress)?.extractedFields.applicationAddress;
  const lease = c.documents.find((d) => d.kind === "rental_agreement" && d.extractedFields.address);
  const caseNumber = c.facts.caseNumber?.value ?? c.documents.find((d) => d.extractedFields.caseNumber)?.extractedFields.caseNumber;
  const movedOn = lease?.extractedFields.startDate ?? "";
  if (!app || !lease || !caseNumber || !/^\d{4}-\d{2}-\d{2}$/.test(movedOn)) return null;
  const newAddress = lease.extractedFields.address;
  if (norm(app) === norm(newAddress)) return null;
  return { oldAddress: app, newAddress, movedOn, caseNumber };
}

/** The user says they moved or want the address updated (any of the counter's languages, English first). */
export const ADDRESS_INTENT = /\b(address|moved|move[ds]? out|adres\p{L}*|przeprowadzi\p{L}*|wyprowadzi\p{L}*)\b/iu;

/** Wait this long for Spark 1.3's card before taking 1.2's. */
const STRONG_WAIT_MS = 3500;

type Card = { text: string; model: string };

async function card(env: VoiceEnv, role: "reason" | "interpret", effort: "low" | "minimal", user: string, lang: string): Promise<Card | null> {
  try {
    const r = await streamLines(env, { role, effort, system: coachSystem(lang), messages: [{ role: "user", content: user }], speak: [], maxTokens: 2500 }, {});
    const text = (r.fields.CARD ?? "").trim();
    return text && !/^none\.?$/i.test(text) ? { text, model: r.model } : null;
  } catch {
    return null;
  }
}

/**
 * The coach card for one official turn: Spark 1.3 (low effort) and 1.2 (minimal) start together. 1.3 decides if it
 * answers within STRONG_WAIT_MS (including "no card"), otherwise 1.2 does. One card, never swapped once shown.
 */
export async function coachCard(env: VoiceEnv, user: string, lang: string): Promise<Card | null> {
  const strong = card(env, "reason", "low", user, lang);
  const fast = card(env, "interpret", "minimal", user, lang);
  const timer = new Promise<"late">((r) => setTimeout(() => r("late"), STRONG_WAIT_MS));
  const first = await Promise.race([strong.then((c) => ({ c })), timer]);
  return first !== "late" ? first.c : fast;
}
