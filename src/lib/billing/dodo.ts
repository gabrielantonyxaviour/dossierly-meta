import type { Env } from "@/lib/server/env";
import { ApiError } from "@/lib/server/http";
import { fromBase64, hmacSha256, timingSafeEqual } from "@/lib/server/util";
import { CURRENCY, type PaidPlan } from "./plans";

const baseUrl = (env: Env) => (env.DODO_ENV === "live_mode" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");

async function dodo<T>(env: Env, path: string, body: unknown): Promise<T> {
  if (!env.DODO_PAYMENTS_API_KEY) throw new ApiError(503, "Payments are not configured", "billing_unconfigured");
  let res: Response;
  try {
    res = await fetch(`${baseUrl(env)}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.DODO_PAYMENTS_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(502, "The payment provider is unreachable. Try again shortly.", "billing_unavailable");
  }
  if (!res.ok) throw new ApiError(502, "The payment provider rejected the request. Try again shortly.", "billing_unavailable");
  return (await res.json()) as T;
}

/** Product ids per plan; the founding price is its own PLN 99 product so the card/BLIK/P24 amount is fixed by Dodo. */
export function productId(env: Env, plan: PaidPlan, founding: boolean): string {
  const id = plan === "household_year" ? env.DODO_PRODUCT_HOUSEHOLD_YEAR : founding ? env.DODO_PRODUCT_ONE_CASE_FOUNDING : env.DODO_PRODUCT_ONE_CASE;
  if (!id) throw new ApiError(503, "Payments are not configured", "billing_unconfigured");
  return id;
}

/**
 * A single-use flat PLN discount worth exactly this checkout's referral discount plus credit.
 * Dodo flat codes carry per-currency amounts in grosz; usage_limit 1 and a 24h expiry keep it from leaking.
 */
export async function createDiscount(env: Env, purchaseId: string, grosz: number): Promise<string> {
  const code = `DSR${purchaseId.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}`;
  const out = await dodo<{ code: string }>(env, "/discounts", {
    type: "flat", amount: grosz, code, usage_limit: 1,
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    currency_options: [{ currency: CURRENCY, is_default: true, max_amount_possible: grosz, minimum_subtotal: 0 }],
    metadata: { purchase_id: purchaseId },
  });
  return out.code ?? code;
}

export async function createCheckoutSession(
  env: Env,
  o: { purchaseId: string; productId: string; discountCode?: string; returnUrl: string },
): Promise<{ sessionId: string; checkoutUrl: string }> {
  const out = await dodo<{ session_id: string; checkout_url: string | null }>(env, "/checkouts", {
    product_cart: [{ product_id: o.productId, quantity: 1 }],
    ...(o.discountCode ? { discount_codes: [o.discountCode] } : {}),
    billing_currency: CURRENCY,
    return_url: o.returnUrl,
    metadata: { purchase_id: o.purchaseId },
  });
  if (!out.checkout_url) throw new ApiError(502, "The payment provider did not return a checkout", "billing_unavailable");
  return { sessionId: out.session_id, checkoutUrl: out.checkout_url };
}

/** Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${body}`, secret is base64 after an optional `whsec_`. */
export async function verifyWebhook(secret: string, headers: Headers, raw: string, nowMs = Date.now()): Promise<boolean> {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!secret || !id || !ts || !sigHeader) return false;
  const seconds = Number(ts);
  if (!Number.isFinite(seconds) || Math.abs(nowMs / 1000 - seconds) > 300) return false;
  let key: Uint8Array;
  try {
    key = fromBase64(secret.replace(/^whsec_/, ""));
  } catch {
    return false;
  }
  const expected = btoa(String.fromCharCode(...(await hmacSha256(key, `${id}.${ts}.${raw}`))));
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
}
