/*
 * Worker-level routing for voice WebSockets (Next route handlers cannot upgrade). Called first from worker/index.ts.
 *   /api/voice/ws/<sessionId>?t=<ticket>   browser session
 *   /api/twilio/media/<ticket>             Twilio Media Stream (Twilio drops query strings, so the ticket is the path)
 * The ticket is minted by the authenticated /api/voice/session (or the Twilio call route) and names the VoiceDO.
 */
import { verifyTicket, type Ticket } from "../token";

type Env = {
  SESSION_SECRET?: string;
  VOICE_DO_LOCATION?: string;
  VOICE_DO?: { idFromName(n: string): unknown; get(id: unknown, o?: { locationHint?: string }): { fetch(r: Request): Promise<Response> } };
};

/**
 * Where voice sessions run. Meta's model API answers 404 from some Cloudflare locations (seen: HKG; SIN works), and
 * a session's Durable Object otherwise lands near the caller. Pinned to a region where every provider answers;
 * VOICE_DO_LOCATION overrides (a Cloudflare location hint: weur, eeur, enam, wnam, apac, oc, ...).
 */
const LOCATION = "weur";

const BROWSER = /^\/api\/voice\/ws\/([A-Za-z0-9_-]{8,64})$/;
const TWILIO = /^\/api\/twilio\/media\/([A-Za-z0-9_.-]{20,3000})$/;

const deny = (status: number, error: string, code: string) => Response.json({ error, code }, { status });

export async function routeVoice(req: Request, env: Env): Promise<Response | null> {
  const url = new URL(req.url);
  const b = BROWSER.exec(url.pathname);
  const tw = b ? null : TWILIO.exec(url.pathname);
  if (!b && !tw) return null;
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") return deny(426, "Expected a WebSocket upgrade", "upgrade_required");
  if (!env.VOICE_DO) return deny(503, "Voice is not available on this deployment", "voice_unavailable");
  const ticket: Ticket | null = await verifyTicket(env.SESSION_SECRET ?? "", b ? url.searchParams.get("t") : tw![1]);
  if (!ticket) return deny(401, "This voice session has expired; start it again", "bad_ticket");
  if (b && ticket.s !== b[1]) return deny(401, "Session mismatch", "bad_ticket");
  if (tw && ticket.m !== "phone") return deny(401, "Not a phone session", "bad_ticket");
  const headers = new Headers(req.headers);
  headers.set("x-voice-ticket", JSON.stringify(ticket));
  headers.set("x-voice-kind", tw ? "twilio" : "browser");
  const stub = env.VOICE_DO.get(env.VOICE_DO.idFromName(ticket.s), { locationHint: env.VOICE_DO_LOCATION || LOCATION });
  return stub.fetch(new Request(req.url, { method: "GET", headers }));
}
