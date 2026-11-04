import { getEnv, type DOStubLike } from "@/lib/server/env";
import { handleCaseRequest } from "./handler";
import { memorySql } from "./memory-sql";
import { CaseStore } from "./store";
import type { Collection, CaseItemMap, CaseSnapshot, Facts, Profile } from "./types";

export class CaseClientError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

const dev = globalThis as unknown as { __caseDev?: Map<string, CaseStore> };

/** Stub for a user's CaseDO. Without the CASE_DO binding, non-production falls back to in-process memory. */
function stubFor(userId: string): DOStubLike {
  const env = getEnv() as unknown as { CASE_DO?: { idFromName(n: string): unknown; get(id: unknown): DOStubLike }; APP_ENV?: string };
  if (env.CASE_DO) return env.CASE_DO.get(env.CASE_DO.idFromName(userId));
  if (env.APP_ENV === "production") throw new CaseClientError(503, "Case storage is unavailable", "case_unavailable");
  const stores = (dev.__caseDev ??= new Map());
  let store = stores.get(userId);
  if (!store) stores.set(userId, (store = new CaseStore(memorySql())));
  const s = store;
  return { fetch: (input, init) => handleCaseRequest(s, new Request(input, init)) };
}

export interface CaseClient {
  snapshot(): Promise<CaseSnapshot>;
  patchProfile(patch: unknown): Promise<Profile>;
  patchFacts(patch: unknown): Promise<Facts>;
  list<K extends Collection>(kind: K): Promise<CaseItemMap[K][]>;
  create<K extends Collection>(kind: K, input: unknown): Promise<CaseItemMap[K]>;
  patch<K extends Collection>(kind: K, id: string, patch: unknown): Promise<CaseItemMap[K]>;
  remove(kind: Collection, id: string): Promise<void>;
}

export function caseClient(userId: string): CaseClient {
  const call = async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const res = await stubFor(userId).fetch(`https://case.do/${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) throw new CaseClientError(res.status, data.error ?? "Case request failed", data.code);
    return data as T;
  };
  return {
    snapshot: () => call("snapshot"),
    patchProfile: (p) => call("profile", "PATCH", p),
    patchFacts: (p) => call("facts", "PATCH", p),
    list: (k) => call(k),
    create: (k, i) => call(k, "POST", i),
    patch: (k, id, p) => call(`${k}/${encodeURIComponent(id)}`, "PATCH", p),
    remove: async (k, id) => void (await call(`${k}/${encodeURIComponent(id)}`, "DELETE")),
  };
}
