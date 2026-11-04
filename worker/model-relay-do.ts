import { DurableObject } from "cloudflare:workers";
import { RELAY_HOSTS, RELAY_TARGET_HEADER, RELAY_TIMEOUT_HEADER } from "../src/lib/model/relay";

/**
 * Forwards one model API call from western Europe (created with locationHint "weur"). Meta's API answers 404 from
 * some Cloudflare edge locations (seen: HKG); src/lib/model/meta.ts re-sends a 404'd call through here once.
 * Only api.meta.ai is reachable through it; the caller's Authorization header is passed on (it never leaves
 * Cloudflare); streamed responses pass straight through.
 */
export class ModelRelayDO extends DurableObject<Record<string, unknown>> {
  async fetch(request: Request): Promise<Response> {
    const deny = (status: number, error: string) => Response.json({ error, code: "relay_refused" }, { status });
    if (request.method !== "POST") return deny(405, "POST only");
    let target: URL;
    try {
      target = new URL(request.headers.get(RELAY_TARGET_HEADER) ?? "");
    } catch {
      return deny(400, "Missing relay target");
    }
    if (target.protocol !== "https:" || !RELAY_HOSTS.has(target.hostname)) return deny(403, "Relay target not allowed");
    const timeoutMs = Math.min(Math.max(Number(request.headers.get(RELAY_TIMEOUT_HEADER)) || 90_000, 1_000), 120_000);
    const headers = new Headers();
    for (const h of ["authorization", "content-type", "accept"]) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    const res = await fetch(target.toString(), { method: "POST", headers, body: request.body, signal: AbortSignal.timeout(timeoutMs) });
    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream" } });
  }
}
