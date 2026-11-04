import type { CaseSnapshot, DOC_KINDS } from "@/lib/case/types";

/**
 * Resolves a MOS field's caseKey against the case snapshot.
 * Vocabulary: "profile.<field>", "facts.<key>", "documents.<kind>.<extractedField>".
 */
export function resolveCaseKey(snap: CaseSnapshot | null, key: string | null): string | null {
  if (!snap || !key) return null;
  const [head, a, b] = key.split(".");
  if (head === "profile" && a) {
    const v = (snap.profile as Record<string, unknown>)[a];
    return typeof v === "string" && v.trim() ? v : null;
  }
  if (head === "facts" && a) return (snap.facts as Record<string, { value: string } | undefined>)[a]?.value ?? null;
  if (head === "documents" && a && b) {
    const doc = snap.documents.find((d) => d.kind === (a as (typeof DOC_KINDS)[number]) && d.status === "have" && d.extractedFields[b]);
    return doc?.extractedFields[b] ?? null;
  }
  return null;
}

/** Splits "Arjun Raman" style full names for surname / given-name fields when the case has only fullName. */
export function nameParts(full: string | null): { given: string | null; surname: string | null } {
  if (!full) return { given: null, surname: null };
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { given: parts[0] ?? null, surname: null };
  return { given: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}
