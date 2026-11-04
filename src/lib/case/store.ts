import {
  COLLECTIONS,
  type Collection,
  type CaseItemMap,
  type CaseSnapshot,
  type Facts,
  type Profile,
  defaultProfile,
  factsPatchSchema,
  factsSchema,
  itemSchemas,
  createSchemas,
  patchSchemas,
  profilePatchSchema,
  profileSchema,
} from "./types";

/** Minimal SQL surface (matches Durable Object `ctx.storage.sql.exec(q, ...b).toArray()`). */
export interface SqlLike {
  exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): T[];
}

export class CaseError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

const Q = {
  items: "CREATE TABLE IF NOT EXISTS items (kind TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY (kind, id))",
  singles: "CREATE TABLE IF NOT EXISTS singles (key TEXT PRIMARY KEY, json TEXT NOT NULL)",
  getSingle: "SELECT json FROM singles WHERE key = ?",
  putSingle: "INSERT OR REPLACE INTO singles (key, json) VALUES (?, ?)",
  list: "SELECT json FROM items WHERE kind = ?",
  getItem: "SELECT json FROM items WHERE kind = ? AND id = ?",
  putItem: "INSERT OR REPLACE INTO items (kind, id, json) VALUES (?, ?, ?)",
  delItem: "DELETE FROM items WHERE kind = ? AND id = ?",
} as const;
export const CASE_QUERIES = Q;

const now = () => new Date().toISOString();
const newId = (kind: string) => `${kind.slice(0, 3)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

function sortItems<K extends Collection>(kind: K, rows: CaseItemMap[K][]): CaseItemMap[K][] {
  const key = (r: Record<string, unknown>): string =>
    String(kind === "deadlines" ? r.dueDate : kind === "appointments" || kind === "events" ? r.at : r.createdAt);
  const sorted = [...rows].sort((a, b) => key(a as never).localeCompare(key(b as never)));
  return kind === "events" ? sorted.reverse() : sorted; // timeline: newest first
}

export class CaseStore {
  constructor(private sql: SqlLike) {
    sql.exec(Q.items);
    sql.exec(Q.singles);
  }

  private single<T>(key: string): T | null {
    const row = this.sql.exec<{ json: string }>(Q.getSingle, key)[0];
    return row ? (JSON.parse(row.json) as T) : null;
  }

  getProfile(): Profile {
    return this.single<Profile>("profile") ?? defaultProfile();
  }

  getFacts(): Facts {
    return this.single<Facts>("facts") ?? {};
  }

  patchProfile(input: unknown): Profile {
    const patch = profilePatchSchema.parse(input);
    const cur = this.getProfile();
    const next = profileSchema.parse({ ...cur, ...patch, phone: patch.phone ? { ...cur.phone, ...patch.phone } : cur.phone });
    this.sql.exec(Q.putSingle, "profile", JSON.stringify(next));
    return next;
  }

  patchFacts(input: unknown): Facts {
    const patch = factsPatchSchema.parse(input);
    const next: Record<string, unknown> = { ...this.getFacts() };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else if (v !== undefined) next[k] = v;
    }
    const facts = factsSchema.parse(next);
    this.sql.exec(Q.putSingle, "facts", JSON.stringify(facts));
    return facts;
  }

  list<K extends Collection>(kind: K): CaseItemMap[K][] {
    const rows = this.sql.exec<{ json: string }>(Q.list, kind).map((r) => JSON.parse(r.json) as CaseItemMap[K]);
    return sortItems(kind, rows);
  }

  get<K extends Collection>(kind: K, id: string): CaseItemMap[K] | null {
    const row = this.sql.exec<{ json: string }>(Q.getItem, kind, id)[0];
    return row ? (JSON.parse(row.json) as CaseItemMap[K]) : null;
  }

  create<K extends Collection>(kind: K, input: unknown): CaseItemMap[K] {
    const parsed = createSchemas[kind].parse(input) as Record<string, unknown>;
    const id = (parsed.id as string | undefined) ?? newId(kind);
    if (this.get(kind, id)) throw new CaseError(409, "That item already exists", "exists");
    const at = now();
    const base: Record<string, unknown> = { ...parsed, id, createdAt: at };
    if (kind === "documents") Object.assign(base, { status: "have", fileKey: null, pages: null, extractedFields: {}, source: "user", ...parsed, id, createdAt: at });
    if (kind === "deadlines") Object.assign(base, { computation: { steps: [], rule: null, legalRefUrl: null }, triggeredBy: null, status: "open", reminders: [], ...parsed, id, createdAt: at });
    if (kind === "tasks") Object.assign(base, { detail: "", dueDeadlineId: null, origin: "user", status: "open", ...parsed, id, createdAt: at });
    if (kind === "events") Object.assign(base, { at, refs: [], ...parsed, id, createdAt: at });
    if (kind === "appointments") Object.assign(base, { location: { name: "TBD", address: "" }, purpose: "", prepTaskIds: [], ...parsed, id, createdAt: at });
    const item = itemSchemas[kind].parse(base) as CaseItemMap[K];
    this.sql.exec(Q.putItem, kind, id, JSON.stringify(item));
    return item;
  }

  patch<K extends Collection>(kind: K, id: string, input: unknown): CaseItemMap[K] {
    const patch = patchSchemas[kind].parse(input);
    const cur = this.get(kind, id);
    if (!cur) throw new CaseError(404, "Item not found", "not_found");
    const item = itemSchemas[kind].parse({ ...cur, ...patch, id, createdAt: (cur as { createdAt: string }).createdAt }) as CaseItemMap[K];
    this.sql.exec(Q.putItem, kind, id, JSON.stringify(item));
    return item;
  }

  remove(kind: Collection, id: string): void {
    if (!this.get(kind, id)) throw new CaseError(404, "Item not found", "not_found");
    this.sql.exec(Q.delItem, kind, id);
  }

  snapshot(): CaseSnapshot {
    const [documents, deadlines, tasks, events, appointments] = COLLECTIONS.map((k) => this.list(k)) as [
      CaseSnapshot["documents"], CaseSnapshot["deadlines"], CaseSnapshot["tasks"], CaseSnapshot["events"], CaseSnapshot["appointments"],
    ];
    return { profile: this.getProfile(), facts: this.getFacts(), documents, deadlines, tasks, events, appointments };
  }
}
