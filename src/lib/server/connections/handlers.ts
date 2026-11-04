import { z } from "zod";
import { getEnv } from "../env";
import { requireUserState } from "../session";
import { ApiError, errorResponse } from "../http";
import { checkEmailOrigin } from "../email-auth";
import { callback, connect, disconnect, status } from "./service";
import { createEvent, deleteOwnedEvent, listCalendars } from "./calendar";
import { importMail, searchMail } from "./mail";
import { disconnectSchema, type ConnectionsEnv } from "./types";

async function input(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "Send JSON for this request.", "invalid_json");
  const reader = req.body?.getReader(); let text = ""; let bytes = 0;
  if (reader) for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength;
    if (bytes > 10000) { await reader.cancel(); throw new ApiError(413, "Request too large.", "request_too_large"); } text += new TextDecoder().decode(next.value, { stream: true }); }
  try { return JSON.parse(text); } catch { throw new ApiError(400, "Send valid JSON.", "invalid_json"); }
}
const response = (data: unknown) => Response.json(data, { headers: { "cache-control": "no-store" } });
export function handler(action: "status" | "connect" | "disconnect" | "callback" | "mail" | "import" | "calendars" | "event" | "deleteEvent") {
  return async (req: Request): Promise<Response> => {
    try {
      const env = getEnv() as ConnectionsEnv;
      const { accountId } = await requireUserState(req);
      if (req.method !== "GET") checkEmailOrigin(req, env);
      switch (action) {
        case "status": return response(await status(env, accountId));
        case "connect": return response(await connect(env, accountId, req, await input(req)));
        case "disconnect": return response(await disconnect(env, accountId, disconnectSchema.parse(await input(req)).category));
        case "callback": {
          // A denied consent or expired link returns the person to setup with a message, never a JSON page.
          const path = await callback(env, accountId, req).then((p) => ({ p, ok: true }), () => ({ p: "/onboarding", ok: false }));
          const url = new URL(path.p, env.APP_URL); url.searchParams.set("connection", path.ok ? "connected" : "failed");
          return new Response(null, { status: 303, headers: { location: url.toString(), "cache-control": "no-store", "referrer-policy": "no-referrer" } });
        }
        case "mail": { const q = new URL(req.url).searchParams; return response(await searchMail(env, accountId, { q: q.get("q") ?? "", ...(q.has("cursor") ? { cursor: q.get("cursor") } : {}) })); }
        case "import": return response(await importMail(env, accountId, await input(req)));
        case "calendars": return response(await listCalendars(env, accountId));
        case "event": return response(await createEvent(env, accountId, await input(req)));
        case "deleteEvent": return response(await deleteOwnedEvent(env, accountId, await input(req)));
      }
    } catch (e) {
      // Provider schemas must not leak third-party payloads in Zod issue details.
      return errorResponse(e instanceof z.ZodError ? new ApiError(400, "Invalid request or provider response.", "invalid_request") : e);
    }
  };
}
