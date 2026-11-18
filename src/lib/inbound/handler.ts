import { z } from "zod";
import { getEnv } from "../server/env";
import { requireUserState } from "../server/session";
import { ApiError, errorResponse } from "../server/http";
import { checkEmailOrigin } from "../server/email-auth";
import { getOrCreateAddress, rotateAddress, type InboundEnv } from "./address";

const rotateBody = z.object({}).strict();
const json = (data: unknown) => Response.json(data, { headers: { "cache-control": "no-store" } });

/** GET creates the forwarding address on first use; POST rotate replaces it (the old one stops accepting mail). */
export function addressHandler(action: "get" | "rotate") {
  return async (req: Request): Promise<Response> => {
    try {
      const env = getEnv() as InboundEnv;
      const { accountId } = await requireUserState(req);
      if (action === "get") return json(await getOrCreateAddress(env, accountId));
      checkEmailOrigin(req, env as never);
      const text = await req.text();
      if (text.length > 100) throw new ApiError(413, "Request too large.", "request_too_large");
      let body: unknown = {};
      try { body = text.trim() ? JSON.parse(text) : {}; } catch { throw new ApiError(400, "Send valid JSON.", "invalid_json"); }
      rotateBody.parse(body);
      return json(await rotateAddress(env, accountId));
    } catch (e) {
      return errorResponse(e instanceof z.ZodError ? new ApiError(400, "Invalid request.", "invalid_request") : e);
    }
  };
}
