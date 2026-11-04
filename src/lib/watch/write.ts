import { caseClient, CaseClientError, type CaseClient } from "../case/client";

type Kind = "documents" | "deadlines" | "events";

/** Create, or merge when the item exists from an earlier attempt at the same email (idempotent). */
export async function upsert(c: CaseClient, kind: Kind, item: Record<string, unknown> & { id: string }): Promise<void> {
  try {
    await c.create(kind, item);
  } catch (e) {
    if (!(e instanceof CaseClientError) || e.status !== 409) throw e;
    const { id, ...patch } = item;
    await c.patch(kind, id, patch);
  }
}

export { caseClient };
