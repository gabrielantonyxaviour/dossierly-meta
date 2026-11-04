/*
 * Fallback route for model calls: Meta's API answers 404 from some Cloudflare edge locations (seen: HKG, while SIN
 * and western Europe work). A call that gets a 404 is re-sent once through ModelRelayDO (worker/model-relay-do.ts),
 * a Durable Object created in western Europe, which forwards it to api.meta.ai.
 */
export const RELAY_TARGET_HEADER = "x-relay-target";
export const RELAY_TIMEOUT_HEADER = "x-relay-timeout-ms";
export const RELAY_HOSTS = new Set(["api.meta.ai"]);
const POOL = 4;

export type RelayNamespace = {
  idFromName(name: string): unknown;
  get(id: unknown, o?: { locationHint?: string }): { fetch(input: string, init?: RequestInit): Promise<Response> };
};

export function relayOf(env: unknown): RelayNamespace | null {
  const ns = (env as { MODEL_RELAY?: RelayNamespace } | undefined)?.MODEL_RELAY;
  return ns && typeof ns.idFromName === "function" ? ns : null;
}

/** "fallback" (default): only a 404'd call is relayed. "always": every Meta call goes through the relay. */
export function relayMode(env: unknown): "fallback" | "always" {
  return (env as { MODEL_RELAY_MODE?: unknown } | undefined)?.MODEL_RELAY_MODE === "always" ? "always" : "fallback";
}

/** True when this URL may go through the relay (only the Meta API host). */
export function relayable(url: string): boolean {
  try {
    return RELAY_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Sends the same request through a western-Europe relay instance (a small pool spreads concurrent calls). */
export function viaRelay(ns: RelayNamespace, url: string, init: RequestInit & { headers: Record<string, string> }, timeoutMs: number): Promise<Response> {
  const stub = ns.get(ns.idFromName(`meta-relay-${Math.floor(Math.random() * POOL)}`), { locationHint: "weur" });
  return stub.fetch("https://model-relay/forward", {
    method: "POST",
    headers: { ...init.headers, [RELAY_TARGET_HEADER]: url, [RELAY_TIMEOUT_HEADER]: String(timeoutMs) },
    body: init.body,
    signal: init.signal,
  });
}
