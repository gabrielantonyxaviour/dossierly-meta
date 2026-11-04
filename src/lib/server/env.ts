import { getCloudflareContext } from "@opennextjs/cloudflare";
import { localEnv } from "./local";

/* Structural bindings: keep Next's DOM typings free of @cloudflare/workers-types. */
export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface D1Like {
  prepare(sql: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown[]>;
}
export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}
export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array | string): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}
export interface DOStubLike {
  fetch(input: string | Request, init?: RequestInit): Promise<Response>;
}
export interface DONamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DOStubLike;
}
export interface WorkflowLike {
  create(opts?: { id?: string; params?: unknown }): Promise<{ id: string }>;
}

export type Env = {
  DB: D1Like;
  CACHE: KVLike;
  BLOBS: R2Like;
  USER_DO: DONamespaceLike;
  PREPARE_FALLBACK?: WorkflowLike;
  LETTER_PIPELINE?: WorkflowLike;
  NIGHTLY_WATCH?: WorkflowLike;
  /* secrets (empty string when unset) */
  /** Meta Model API key; per-role overrides name another env var through MODEL_<ROLE>_KEY_ENV. */
  MODEL_API_KEY: string;
  BRIDGE_SECRET: string;
  SESSION_SECRET: string;
  RESEND_API_KEY?: string;
  /** Bare verified sender selected for this environment. QA may use the shared mail service. */
  EMAIL_FROM?: string;
  COMPOSIO_API_KEY?: string;
  COMPOSIO_PROJECT_ID?: string;
  COMPOSIO_GMAIL_AUTH_CONFIG_ID?: string;
  COMPOSIO_OUTLOOK_AUTH_CONFIG_ID?: string;
  COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID?: string;
  COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID?: string;
  COMPOSIO_GMAIL_DISABLED_REASON?: string;
  COMPOSIO_GMAIL_TEST_USERS?: string;
  DODO_PAYMENTS_API_KEY: string;
  DODO_WEBHOOK_KEY: string;
  JUDGE_CODE: string;
  /* plain vars */
  DODO_ENV: "test_mode" | "live_mode";
  DODO_PRODUCT_CASE_PASS: string;
  DODO_PRODUCT_CREDITS_10: string;
  DODO_PRODUCT_CREDITS_25: string;
  DODO_PRODUCT_FAMILY: string;
  APP_URL: string;
  APP_ENV: "local" | "preview" | "production";
  /** "1" switches every model call off (set as a secret or var; see docs/BUILD.md). */
  MODELS_DISABLED?: string;
};

const STRING_KEYS = [
  "MODEL_API_KEY", "BRIDGE_SECRET", "SESSION_SECRET",
  "DODO_PAYMENTS_API_KEY", "DODO_WEBHOOK_KEY", "JUDGE_CODE", "DODO_PRODUCT_CASE_PASS",
  "DODO_PRODUCT_CREDITS_10", "DODO_PRODUCT_CREDITS_25", "DODO_PRODUCT_FAMILY", "APP_URL",
  "RESEND_API_KEY", "EMAIL_FROM",
  "COMPOSIO_API_KEY", "COMPOSIO_PROJECT_ID", "COMPOSIO_GMAIL_AUTH_CONFIG_ID", "COMPOSIO_OUTLOOK_AUTH_CONFIG_ID", "COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID", "COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID", "COMPOSIO_GMAIL_DISABLED_REASON", "COMPOSIO_GMAIL_TEST_USERS",
] as const;

function readCloudflare(): Partial<Env> | null {
  try {
    const env = getCloudflareContext().env as unknown as Partial<Env> | undefined;
    return env && env.DB ? env : null;
  } catch {
    return null;
  }
}

/** Bindings inside Workers; process.env plus in-memory stubs under `next dev` and vitest. */
export function getEnv(): Env {
  const cf = readCloudflare();
  if (!cf) return localEnv();
  const out = { ...cf } as Record<string, unknown>;
  for (const k of STRING_KEYS) if (typeof out[k] !== "string") out[k] = "";
  out.DODO_ENV = /^live/.test(String(out.DODO_ENV)) ? "live_mode" : "test_mode";
  out.APP_ENV = out.APP_ENV ?? "production";
  return out as unknown as Env;
}
