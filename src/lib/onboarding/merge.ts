import type { Finding } from "./findings";

type Doc = Extract<Finding, { kind: "document" }>;
const rank = { have: 2, requested: 1, missing: 0 } as const;

/**
 * One case document per id across emails. A copy found in the inbox ("have", with its file) beats a request for it;
 * the request's email stays the source for a document nobody sent. Asked for and never found → "missing".
 * Fields (address, start date…) are merged from every email that mentions the document.
 */
export function mergeDocuments(findings: Finding[]): Doc[] {
  const byId = new Map<string, { best: Doc; requested: Doc | null; fields: Record<string, string> }>();
  for (const f of findings) {
    if (f.kind !== "document") continue;
    const cur = byId.get(f.id);
    if (!cur) { byId.set(f.id, { best: f, requested: f.status === "requested" ? f : null, fields: { ...f.fields } }); continue; }
    if (rank[f.status] > rank[cur.best.status]) cur.best = f;
    if (f.status === "requested" && !cur.requested) cur.requested = f;
    Object.assign(cur.fields, f.fields);
  }
  return [...byId.values()].map(({ best, requested, fields }) => {
    if (requested) fields.requestedBy = requested.source.subject.slice(0, 160);
    const status = best.status === "have" ? "have" : "missing";
    return { ...(status === "missing" && requested ? requested : best), status, ...(Object.keys(fields).length ? { fields } : {}) } as Doc;
  });
}
