import { DurableObject } from "cloudflare:workers";
import { attachVoiceSocket } from "../src/lib/voice/server/socket";

/** One per live voice session (idFromName(sessionId)): relays audio between the caller and Meta ASR / Spark / ElevenLabs. */
export class VoiceDO extends DurableObject<Record<string, unknown>> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return Response.json({ error: "Expected a WebSocket", code: "upgrade_required" }, { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    try {
      attachVoiceSocket(server as never, request.headers, this.env as never, () => undefined);
    } catch {
      return Response.json({ error: "Bad voice session", code: "bad_ticket" }, { status: 400 });
    }
    return new Response(null, { status: 101, webSocket: client });
  }
}
