import type { Env } from "@/lib/server/env";
import { randomId } from "@/lib/server/util";

export type AuditAction =
  | "whitelist.add" | "whitelist.remove" | "whitelist.used"
  | "promo.add" | "promo.disable" | "promo.used"
  | "admin.denied";

export type AuditEvent = { id: string; at: string; actor: string; action: AuditAction; subject: string; detail: string };

export async function writeAudit(env: Env, actor: string, action: AuditAction, subject: string, detail = "", now = Date.now()): Promise<void> {
  await env.DB.prepare("INSERT INTO audit_log (id, at, actor, action, subject, detail) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(randomId("au", 12), now, actor, action, subject.slice(0, 300), detail.slice(0, 600)).run();
}

/** Newest first. */
export async function listAudit(env: Env, limit = 100): Promise<AuditEvent[]> {
  const { results } = await env.DB.prepare("SELECT id, at, actor, action, subject, detail FROM audit_log ORDER BY at DESC, rowid DESC LIMIT ?")
    .bind(limit).all<{ id: string; at: number; actor: string; action: AuditAction; subject: string; detail: string }>();
  return results.map((r) => ({ ...r, at: new Date(r.at).toISOString() }));
}
