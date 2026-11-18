/*
 * The content-origin gate. Meta's promotional credits allow Meta to use content for product improvement, so a real
 * user's content (letters, photos, emails, messages, voice, case data) must not reach any Meta model until
 * META_USER_CONTENT=allow. This is code that refuses, not configuration: resolveRole() calls it for every role and
 * service, and meta.ts calls it again before every request, so no Meta network call can be made without passing it.
 */
import type { ContentOrigin, Provider } from "../config";
import { ModelError } from "./types";

export type { ContentOrigin };

/** Anything that is not exactly "demo" or "eval" is real user content. A missing origin fails closed. */
export function normaliseOrigin(origin: unknown): ContentOrigin {
  return origin === "demo" || origin === "eval" ? origin : "user";
}

export const BLOCKED_MESSAGE = "This feature is not available for your account yet.";

/** The lift switch. Read from env at call time so it can be flipped without a deploy of code. */
export function metaUserContentAllowed(env: object | undefined): boolean {
  const fromEnv = (env as Record<string, unknown> | undefined)?.META_USER_CONTENT;
  const v = typeof fromEnv === "string" && fromEnv.trim() ? fromEnv : typeof process !== "undefined" ? process.env?.META_USER_CONTENT : "";
  return String(v ?? "").trim() === "allow";
}

/** True when a call with this origin may go to this provider. */
export function providerAllowed(provider: Provider, origin: unknown, env: object | undefined): boolean {
  return provider !== "meta" || normaliseOrigin(origin) !== "user" || metaUserContentAllowed(env);
}

/** Throws ModelError code "provider_blocked" (HTTP 403) before any network request when the call is not allowed. */
export function assertProviderAllowed(provider: Provider, origin: unknown, env: object | undefined): void {
  if (!providerAllowed(provider, origin, env)) throw new ModelError(BLOCKED_MESSAGE, "provider_blocked", 403);
}
