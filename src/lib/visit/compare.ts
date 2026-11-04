import type { CaseDocument } from "@/lib/case/types";
import type { PlanItem, Structured } from "./types";

export const OFFICIAL_HOSTS = ["gov.pl", "migrant.wsc.mazowieckie.pl", "mazowieckie.uw.gov.pl", "isap.sejm.gov.pl", "udsc.gov.pl"];

export function isOfficial(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return OFFICIAL_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export interface Cite { url: string; title: string }

/** Dedupes citations by URL (without fragment), official sources first; the order defines the 1-based numbering. */
export function numberCitations(raw: Cite[]): Cite[] {
  const seen = new Map<string, Cite>();
  for (const c of raw) {
    let key = c.url;
    try { const u = new URL(c.url); u.hash = ""; key = u.toString(); } catch { continue; }
    if (!seen.has(key)) seen.set(key, { url: key, title: c.title.trim() || new URL(key).hostname });
  }
  const all = [...seen.values()];
  return [...all.filter((c) => isOfficial(c.url)), ...all.filter((c) => !isOfficial(c.url))].slice(0, 12);
}

const sourceOf = (cites: Cite[], idx: number | null): Cite | null => (idx !== null && idx >= 1 && idx <= cites.length ? cites[idx - 1] : null);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "item";

/**
 * Compares the researched checklist with the case documents by kind. An item is "have" only when a document of
 * that kind exists with status "have"; a kind with no such document is "missing"; no kind means "unknown".
 */
export function compareItems(structured: Structured, docs: CaseDocument[], cites: Cite[]): PlanItem[] {
  const used = new Set<string>();
  return structured.items.map((it) => {
    let id = slug(it.id || it.title);
    for (let n = 2; used.has(id); n++) id = `${slug(it.id || it.title).slice(0, 36)}-${n}`;
    used.add(id);
    const kind = it.matchKind && it.matchKind !== "other" ? it.matchKind : null;
    const have = kind ? docs.find((d) => d.kind === kind && d.status === "have") : undefined;
    return {
      id, title: it.title, detail: it.detail,
      status: !kind ? "unknown" : have ? "have" : "missing",
      caseDocId: have?.id ?? null,
      source: sourceOf(cites, it.sourceIdx),
    };
  });
}

export function officeOf(structured: Structured, cites: Cite[]) {
  const o = structured.office;
  return o && o.name ? { name: o.name, address: o.address, note: o.note, source: sourceOf(cites, o.sourceIdx) } : null;
}
