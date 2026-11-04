const DATE_KEYS = ["dateOnLetter", "deadlineRule.days"];
const KNOWN = new Set(["dateOnLetter", "deadlineRule.days", "deadlineRule.quote", "caseNumber", "office", "asks", "title", "kind", "fields"]);

/**
 * Fields the model said it was unsure about (its own "uncertain" list; the provider exposes no token
 * probabilities). Only known letter fields are kept. When the model omitted the list entirely, every
 * date-bearing field is marked for confirmation instead.
 */
export function lowConfidenceFields(uncertain: string[] | undefined): string[] {
  if (!uncertain) return [...DATE_KEYS, "asks"];
  const out = new Set<string>();
  for (const raw of uncertain) {
    const k = raw.trim().replace(/^deadline(?:Rule)?\.?days$/i, "deadlineRule.days").replace(/^deadlineRule\.quote$/i, "deadlineRule.quote");
    const hit = [...KNOWN].find((n) => n.toLowerCase() === k.toLowerCase());
    if (hit) out.add(hit);
  }
  return [...out];
}
