import { jsonError } from "@/lib/server/http";
import { getEnv } from "@/lib/server/env";
import { verifyWebhook } from "@/lib/billing/dodo";
import { parseEvent, processWebhook } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

/** Dodo Payments webhook (Standard Webhooks signature). Grants on payment.succeeded, revokes on full refund. */
export async function POST(req: Request) {
  const env = getEnv();
  const raw = await req.text();
  if (raw.length > 200_000) return jsonError(413, "Payload too large", "too_large");
  if (!(await verifyWebhook(env.DODO_WEBHOOK_KEY, req.headers, raw))) return jsonError(401, "Invalid signature", "invalid_signature");
  const event = parseEvent(raw);
  const id = req.headers.get("webhook-id");
  if (!event || !id) return jsonError(400, "Invalid event", "invalid_request");
  const r = await processWebhook(env, id, event);
  return r.status === 200 ? Response.json({ received: true }) : jsonError(500, "Could not process the event", "internal");
}
