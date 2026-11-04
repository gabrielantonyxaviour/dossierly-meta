import { z } from "zod";
import type {
  AgentTask, Case, CaseEvent, Interpretation, Intro, Language, Ledger, Letter, LetterLink, LetterRead, Me, Plan,
  Product, Status, TurnInput, WatchResult, WrapResult,
} from "./types";

export type ApiFailure = { ok: false; status: number; error: string; code?: string };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

/** Codes the UI reacts to: pay-walls route to pricing, rate limits get a calm retry message. */
export const needsPlan = (f: ApiFailure) => f.status === 402 || f.status === 403;
export const isRateLimited = (f: ApiFailure) => f.status === 429 || f.code === "rate_limited";

export function friendlyError(f: ApiFailure): string {
  if (f.code === "over_budget") return "Daily limit reached. Try again after 08:00 MYT.";
  if (isRateLimited(f)) return "Lots of requests just now. Wait a few seconds and try again.";
  if (needsPlan(f)) return "You have reached the free limit. Upgrade to Dossierly Plus to continue.";
  if (f.status === 0) return "You seem to be offline. Check the connection and try again.";
  if (f.code === "model_unavailable") return "The model is briefly unavailable. Try again in a few minutes.";
  return f.error || "Something went wrong. Try again.";
}

let sessionPromise: Promise<ApiResult<AccountMe>> | null = null;

async function raw<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: init?.body ? { "content-type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    return { ok: false, status: 0, error: "Network unavailable", code: "offline" };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok) return { ok: true, data: body as T };
  const b = (body ?? {}) as { error?: string; code?: string };
  return { ok: false, status: res.status, error: b.error ?? `Request failed (${res.status})`, code: b.code };
}

/** The signed-in account as returned by /api/me, /api/session and every sign-in route. */
export type Account = {
  accountId: string;
  accountKind: "email" | "passkey" | "device";
  activeCase: "own" | "sample";
  plan: Plan;
  planChosen: boolean;
  lettersUsed: number;
  freeLetters: number;
};

/** Account plus the legacy `Me` fields (`userId` = accountId, `freeLetterUsed`) the older store reads. */
export type AccountMe = Account & Me;
const withLegacy = (a: Account): AccountMe => ({ ...a, userId: a.accountId, freeLetterUsed: a.lettersUsed > 0 });
const mapAccount = (r: ApiResult<Account>): ApiResult<AccountMe> => (r.ok ? { ok: true, data: withLegacy(r.data) } : r);

/** Safe to call anywhere: a missing account is a 401 `no_session` result, never a created user. */
export function getMe(): Promise<ApiResult<AccountMe>> {
  return raw<Account>("/api/me").then(mapAccount);
}

/** Bootstrap helper kept for the store: resolves the current account (shared by concurrent callers). */
export function ensureSession(): Promise<ApiResult<AccountMe>> {
  if (!sessionPromise) {
    sessionPromise = getMe().then((r) => {
      if (!r.ok) sessionPromise = null;
      return r;
    });
  }
  return sessionPromise;
}

const postAccount = async (path: string, body: unknown): Promise<ApiResult<Account>> => {
  const r = await raw<Account>(path, { method: "POST", body: JSON.stringify(body) });
  sessionPromise = r.ok ? Promise.resolve({ ok: true, data: withLegacy(r.data) }) : null;
  return r;
};

/** Switches the active case of the signed-in account: sample=true joins the shared SAMPLE case, false returns to your own. */
export const switchCase = (sample: boolean): Promise<ApiResult<Account>> => postAccount("/api/session", { sample });

/** Same call as `switchCase`, returning the legacy `Me` fields too, for the existing store. */
export async function startSession(sample: boolean): Promise<ApiResult<AccountMe>> {
  return mapAccount(await switchCase(sample));
}

/** Email verification signs in and refreshes the account used by the case store. */
export async function verifyEmailCode(challengeId: string, code: string): Promise<ApiResult<Account>> {
  if (!challengeId || !/^\d{6}$/.test(code)) {
    return { ok: false, status: 400, code: "invalid_code", error: "Enter the six-digit code from your email." };
  }
  const r = await raw<unknown>("/api/auth/email/verify", {
    method: "POST", body: JSON.stringify({ challengeId, code }),
  });
  if (!r.ok) return r;
  const parsed = z.object({
    accountId: z.string().min(1), accountKind: z.literal("email"),
    activeCase: z.enum(["own", "sample"]), planChosen: z.boolean(),
    lettersUsed: z.number().int().nonnegative(), freeLetters: z.number().int().nonnegative(),
    plan: z.object({
      kind: z.enum(["free", "case_pass", "judge"]), creditsLeft: z.number(),
      expiresAt: z.string().nullable().optional(), family: z.boolean().optional(),
    }),
  }).safeParse(r.data);
  if (!parsed.success) return { ok: false, status: 502, error: "Sign-in is temporarily unavailable." };
  sessionPromise = Promise.resolve({ ok: true, data: withLegacy(parsed.data) });
  return { ok: true, data: parsed.data };
}

export async function signOut(): Promise<ApiResult<{ ok: true }>> {
  const r = await raw<{ ok: true }>("/api/auth/signout", { method: "POST", body: "{}" });
  if (r.ok) sessionPromise = null;
  return r;
}

/** The one-time tier choice. Choosing Plus starts a checkout instead (`api.checkout("case_pass")`). */
export const choosePlan = (choice: "free"): Promise<ApiResult<Account>> => postAccount("/api/me/plan", { choice });

/** Sandbox names are internal ids; show only the pool slot (e.g. "pool-03"). */
export function sandboxLabel(name?: string | null): string {
  if (!name) return "";
  return name.replace(/^companion-arjun$/, "sample agent");
}

/** Fetch with typed results. A 401 `no_session` is returned as is: the UI sends the person to sign in. */
export const call = raw;

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) });

const maskProfile = (c: Case) => ({ name: c.profile.name, addresses: c.profile.addresses ?? [] });

export const api = {
  me: getMe,
  status: () => call<Status>("/api/status"),
  ledger: () => call<Ledger>("/api/ledger?limit=200"),
  intro: (name: string, language: Language, office: string) => post<Intro>("/api/intro", { name, language, office }),
  interpret: (c: Case, speaker: "user" | "official", text: string, recent: TurnInput[]) =>
    post<Interpretation>("/api/interpret", { speaker, text, language: c.profile.language, recent: recent.slice(-8), profile: maskProfile(c) }),
  watch: (c: Case, turns: TurnInput[]) =>
    post<WatchResult>("/api/watch", { turns: turns.slice(-12), language: c.profile.language, office: c.office, profile: maskProfile(c) }),
  wrap: (c: Case, turns: TurnInput[]) =>
    post<WrapResult>("/api/wrap", { turns: turns.slice(-80), language: c.profile.language, office: c.office, profile: maskProfile(c) }),
  readLetter: (pages: string[], language: Language) => post<LetterRead>("/api/letters/read", { pages, language }),
  linkLetter: (c: Case, letter: Letter, deliveryDate: string) =>
    post<LetterLink>("/api/letters/link", { letter, deliveryDate, case: c, language: c.profile.language }),
  prepare: (c: Case, appointment: { office: string; purpose: string; date: string }) =>
    post<{ taskId: string; retrieval?: import("./onboarding-state").SourceCapture; masked?: number }>("/api/prepare", { appointment, case: c, language: c.profile.language }),
  fileEvent: (c: Case, event: CaseEvent) => post<{ taskId: string }>("/api/agent/file", { event, case: c }),
  reminder: (date: string, label: string) => post<unknown>("/api/me/deadlines", { date, label: label.slice(0, 120) }),
  task: <R>(id: string) => call<AgentTask<R>>(`/api/agent/tasks/${encodeURIComponent(id)}`),
  hubChanges: () => call<{ changes: { title: string; summary: string; url: string; detectedAt: string }[]; checkedAt?: string | null; kind?: "official_pages"; personalApplicationStatus?: false }>("/api/hub/changes?country=pl"),
  asrTranscribe: (audioB64: string, lang: "pl" | "en" | "uk" | "hi" | "ta", translate?: "en" | "pl") =>
    post<{ status: "done"; text: string; ms: number; model: string; translation?: string; translationModel?: string }>(
      "/api/asr", translate ? { audio: audioB64, lang, translate } : { audio: audioB64, lang },
    ),
  checkout: (product: Product, code?: string) => post<{ checkoutUrl: string }>("/api/checkout", code ? { product, code } : { product }),
  redeem: (code: string) => post<{ plan: Plan }>("/api/redeem", { code }),
};

/** Polls an agent task until done/failed, reporting every snapshot. Stops when `signal` aborts. */
export async function pollTask<R>(
  id: string,
  onUpdate: (t: AgentTask<R>) => void,
  signal: AbortSignal,
  intervalMs = 1200,
): Promise<ApiResult<AgentTask<R>>> {
  for (let i = 0; i < 300 && !signal.aborted; i++) {
    const r = await api.task<R>(id);
    if (!r.ok) {
      if (isRateLimited(r) || r.status === 0) {
        await wait(intervalMs * 2, signal);
        continue;
      }
      return r;
    }
    onUpdate(r.data);
    if (r.data.status === "done" || r.data.status === "failed") return r;
    await wait(intervalMs, signal);
  }
  return { ok: false, status: 408, error: "The agent is taking longer than expected.", code: "timeout" };
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });
