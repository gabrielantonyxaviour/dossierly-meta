/* Binds a server-side WebSocket (browser or Twilio) to a VoiceSession. Used by worker/voice-do.ts. */
import { ticketSchema } from "../token";
import { VoiceSession, type VoiceEnv } from "./session";
import { BrowserTransport, TwilioTransport, ulaw8kToPcm16k } from "./transport";

type ServerSocket = WebSocket & { accept(): void };

/** Hard cap so a forgotten tab cannot hold a session (and the ASR socket) open for hours. */
const MAX_SESSION_MS = 20 * 60_000;

export function attachVoiceSocket(ws: ServerSocket, headers: Headers, env: VoiceEnv, onDone: () => void): void {
  const ticket = ticketSchema.parse(JSON.parse(headers.get("x-voice-ticket") ?? "{}"));
  const kind = headers.get("x-voice-kind") === "twilio" ? "twilio" : "browser";
  ws.accept();
  const transport = kind === "twilio" ? new TwilioTransport(ws) : new BrowserTransport(ws);
  const session = new VoiceSession(env, ticket, transport, onDone);
  const cap = setTimeout(() => void session.finish("time_limit"), MAX_SESSION_MS);
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    void session.start();
  };

  ws.addEventListener("message", (ev: MessageEvent) => {
    const data = ev.data as string | ArrayBuffer;
    if (kind === "browser") {
      if (typeof data === "string") session.onClientText(data);
      else if (data.byteLength <= 32_000) session.onAudio(data);
      return;
    }
    if (typeof data !== "string") return;
    let m: { event?: string; start?: { streamSid?: string }; streamSid?: string; media?: { payload?: string; track?: string } };
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    const tw = transport as TwilioTransport;
    if (m.event === "start") {
      tw.streamSid = m.start?.streamSid ?? m.streamSid ?? null;
      start();
    } else if (m.event === "media" && m.media?.payload && (m.media.track ?? "inbound") === "inbound") {
      const bin = atob(m.media.payload);
      const u = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      session.onAudio(ulaw8kToPcm16k(u));
    } else if (m.event === "stop") {
      void session.finish("caller_hung_up");
    }
  });
  ws.addEventListener("close", () => {
    clearTimeout(cap);
    void session.finish("socket_closed");
  });
  ws.addEventListener("error", () => session.close("socket_error"));
  if (kind === "browser") start();
}
