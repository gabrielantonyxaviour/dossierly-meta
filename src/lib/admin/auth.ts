import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { requireUserState, type UserState } from "@/lib/server/session";
import { writeAudit } from "./audit";

export const DEFAULT_ADMIN_EMAILS = ["gabriel@larinova.com", "contact@cosmiclan.com"];

/** ADMIN_EMAILS (comma-separated) replaces the default list when set and non-empty. */
export function adminEmails(env: Env): string[] {
  const list = (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_ADMIN_EMAILS;
}

/** The account's verified email. Rows in email_identities exist only after the sign-in code was verified. */
export async function verifiedEmail(env: Env, accountId: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id = ? AND verified_at IS NOT NULL").bind(accountId).first<{ email: string }>();
  return r?.email ?? null;
}

export async function isAdminAccount(env: Env, accountId: string): Promise<boolean> {
  const email = await verifiedEmail(env, accountId);
  return !!email && adminEmails(env).includes(email.toLowerCase());
}

/** 401 with no session, 403 `forbidden` (and an audit row) for any signed-in non-admin. Returns the admin's email. */
export async function requireAdmin(env: Env, req: Request): Promise<{ account: UserState; email: string }> {
  const account = await requireUserState(req);
  const email = await verifiedEmail(env, account.accountId);
  if (!email || !adminEmails(env).includes(email.toLowerCase())) {
    await writeAudit(env, email ?? account.accountId, "admin.denied", `${req.method} ${new URL(req.url).pathname}`).catch(() => undefined);
    throw new ApiError(403, "You do not have access to this", "forbidden");
  }
  return { account, email: email.toLowerCase() };
}
