import { getEnv, type Env } from "./env";
import { ApiError } from "./http";
import { resolvePlan } from "./entitlements";
import { FREE_LETTERS } from "@/lib/billing/plans";
import { b64url, hmacSha256, timingSafeEqual } from "./util";

export { FREE_LETTERS };

export const SESSION_COOKIE = "settla_uid";
/** The shared SAMPLE case: one demo user whose private agent is the pinned `companion-arjun` sandbox. */
export const SAMPLE_USER_ID = "sample-arjun";
const MAX_AGE = 60 * 60 * 24 * 400;

export type PlanKind = "free" | "one_case" | "household_year" | "judge";
export type Plan = { kind: PlanKind; creditsLeft: number; expiresAt?: string | null; family?: boolean };
export type AccountKind = "email" | "passkey" | "device";
export type ActiveCase = "own" | "sample";

export type UserState = {
  /** Effective user: `sample-arjun` while the sample case is active, otherwise the account id. */
  userId: string;
  /** The signed-in account; payments, plan and entitlements always attach here. */
  accountId: string;
  accountKind: AccountKind | null;
  activeCase: ActiveCase;
  plan: Plan;
  planChosen: boolean;
  lettersUsed: number;
  /** Legacy flag kept for older callers: any letter has been read. */
  freeLetterUsed: boolean;
};

type Row = {
  plan_kind: string; plan_expires_at: number | null; credits: number; family: number;
  account_kind: AccountKind | null; plan_chosen: number; active_case: ActiveCase; letters_used: number;
  email_user: string | null;
};

async function sign(env: Env, userId: string): Promise<string> {
  if (!env.SESSION_SECRET) throw new ApiError(503, "Sessions are not configured", "session_unconfigured");
  return b64url(await hmacSha256(env.SESSION_SECRET, `uid:${userId}`));
}

const secureFlag = (env: Env) => (env.APP_ENV === "local" ? "" : "; Secure");

/** Signed Set-Cookie header value for an existing user id. */
export async function sessionCookie(userId: string, env: Env = getEnv()): Promise<string> {
  return `${SESSION_COOKIE}=${userId}.${await sign(env, userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secureFlag(env)}`;
}

export function clearedCookie(env: Env = getEnv()): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(env)}`;
}

/** Verifies the signed `uid.sig` cookie out of a raw Cookie header. */
export async function userIdFromCookieHeader(raw: string | null | undefined, env: Env): Promise<string | null> {
  const m = (raw ?? "").split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!m) return null;
  const value = m.slice(SESSION_COOKIE.length + 1);
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const userId = value.slice(0, dot);
  return timingSafeEqual(value.slice(dot + 1), await sign(env, userId)) ? userId : null;
}

export const userIdFromRequest = (req: Request, env: Env) => userIdFromCookieHeader(req.headers.get("cookie"), env);

/** Resolve a user row; expired passes fall back to free. `userId` here is the row id (the account). */
export async function loadUserState(env: Env, userId: string): Promise<UserState | null> {
  const row = await env.DB.prepare(
    "SELECT plan_kind, plan_expires_at, credits, family, account_kind, plan_chosen, active_case, letters_used, (SELECT user_id FROM email_identities WHERE user_id = users.id) AS email_user FROM users WHERE id = ?",
  ).bind(userId).first<Row>();
  if (!row) return null;
  const paid = await resolvePlan(env, userId);
  const judge = row.plan_kind === "judge" && (row.plan_expires_at === null || row.plan_expires_at > Date.now());
  return {
    userId,
    accountId: userId,
    accountKind: row.email_user ? "email" : row.account_kind,
    activeCase: row.active_case === "sample" ? "sample" : "own",
    plan: {
      kind: judge ? "judge" : paid.kind,
      creditsLeft: row.credits,
      expiresAt: paid.expiresAt ? new Date(paid.expiresAt).toISOString() : null,
      family: paid.kind === "household_year",
    },
    planChosen: row.plan_chosen === 1,
    lettersUsed: row.letters_used,
    freeLetterUsed: row.letters_used > 0,
  };
}

/** Plain row insert for payment and redemption paths; never makes the row an account. */
export async function ensureUser(env: Env, userId: string): Promise<void> {
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)").bind(userId, Date.now()).run();
}

/** Legacy account row helper. Email accounts are created through emailAccount after verification. */
export async function createAccountUser(env: Env, userId: string, kind: "passkey" | "device"): Promise<void> {
  await env.DB.prepare("INSERT INTO users (id, created_at, account_kind) VALUES (?, ?, ?)").bind(userId, Date.now(), kind).run();
}

/** An account needs a valid signed cookie and a user row with account_kind set; the sample user is never an account. */
export async function accountFromCookie(raw: string | null | undefined, env: Env): Promise<UserState | null> {
  const id = await userIdFromCookieHeader(raw, env);
  if (!id || id === SAMPLE_USER_ID) return null;
  const state = await loadUserState(env, id);
  return state && state.accountKind ? state : null;
}

/** Throws ApiError(401) without a signed cookie for an account. Returns the effective userId plus accountId. */
export async function requireUserState(req: Request): Promise<UserState> {
  const env = getEnv();
  const account = await accountFromCookie(req.headers.get("cookie"), env);
  if (!account) throw new ApiError(401, "No active session", "no_session");
  return { ...account, userId: account.activeCase === "sample" ? SAMPLE_USER_ID : account.accountId };
}

export async function requireUser(req: Request): Promise<{ userId: string; accountId: string; plan: Plan }> {
  const s = await requireUserState(req);
  return { userId: s.userId, accountId: s.accountId, plan: s.plan };
}
