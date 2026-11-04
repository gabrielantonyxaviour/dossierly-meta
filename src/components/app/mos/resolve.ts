import type { CaseSnapshot, DOC_KINDS } from "@/lib/case/types";

/**
 * Resolves a MOS field's caseKey against the case snapshot.
 * Vocabulary: "profile.<field>", "facts.<key>", "documents.<kind>.<extractedField>".
 */
export function resolveCaseKey(snap: CaseSnapshot | null, key: string | null): string | null {
  if (!snap || !key) return null;
  const [head, a, b] = key.split(".");
  if (head === "profile" && a === "phone") return snap.profile.phone.number;
  if (head === "profile" && a) {
    const v = (snap.profile as Record<string, unknown>)[a];
    return typeof v === "string" && v.trim() ? v : null;
  }
  if (head === "facts" && a) return (snap.facts as Record<string, { value: string } | undefined>)[a]?.value ?? null;
  if (head === "documents" && a && b) {
    const docs = snap.documents.filter((d) => d.kind === (a as (typeof DOC_KINDS)[number]) && d.status === "have");
    const field = (k: string) => docs.map((d) => d.extractedFields[k]).find((v) => v && v.trim()) ?? null;
    const direct = field(b);
    if (direct) return direct;
    // Readers store passports under different keys; fall back to the holder name or the profile name.
    if (a === "passport" && (b === "surname" || b === "givenNames")) {
      const parts = nameParts(field("holder") ?? field("name") ?? snap.profile.fullName);
      return b === "surname" ? parts.surname : parts.given;
    }
    if (a === "passport" && b === "expiryDate") return field("expires") ?? field("expiry");
    return null;
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
