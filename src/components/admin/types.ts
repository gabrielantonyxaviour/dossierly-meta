import { call } from "@/lib/client/api";

export type Grant = { kind: "one_case" | "household_year" | "discount_percent"; value?: number };
export type Entry = { id: string; email: string; grant: Grant; grantExpiresAt: string | null; entryExpiresAt: string | null; note: string; createdBy: string; createdAt: string; usedAt: string | null; usedByAccount: string | null };
export type Promo = { id: string; code: string; kind: "percent"; percent: number; plans: ("one_case" | "household_year")[]; maxUses: number | null; perCustomer: number; startsAt: string | null; expiresAt: string | null; note: string; uses: number; dodoDiscountId: string | null; createdBy: string; createdAt: string; active: boolean };
export type AuditEvent = { id: string; at: string; actor: string; action: string; subject: string; detail: string };
export type Summary = { whitelist: Entry[]; promos: Promo[]; audit: AuditEvent[] };

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
export const adminApi = {
  summary: () => call<Summary>("/api/admin/summary"),
  addEntry: (b: { email: string; grant: Grant; grantExpiresAt?: string; entryExpiresAt?: string; note?: string }) => call<Entry>("/api/admin/whitelist", json("POST", b)),
  removeEntry: (id: string) => call<{ ok: true }>("/api/admin/whitelist", json("DELETE", { id })),
  addPromo: (b: { code: string; percent: number; plans: Promo["plans"]; maxUses?: number; perCustomer?: number; expiresAt?: string; note?: string }) => call<Promo>("/api/admin/promos", json("POST", b)),
  disablePromo: (id: string) => call<Promo>("/api/admin/promos/disable", json("POST", { id })),
};

export const grantLabel = (g: Grant) => (g.kind === "discount_percent" ? `${g.value ?? 0}% off` : g.kind === "one_case" ? "One case, free" : "Household year, free");
export const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
