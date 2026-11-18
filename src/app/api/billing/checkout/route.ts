import { z } from "zod";
import { createCheckout } from "@/lib/billing/checkout";
import { billingRoute } from "@/lib/billing/route";

export const dynamic = "force-dynamic";

const Body = z.object({
  plan: z.enum(["one_case", "household_year"]),
  referralCode: z.string().trim().min(4).max(24).regex(/^[A-Za-z0-9-]+$/).optional(),
  /** An admin-created promo code; replaces the founding price and the referral discount (no stacking). */
  promoCode: z.string().trim().min(1).max(24).optional(),
  /** Where Dodo sends the buyer afterwards; same-site path only. */
  returnPath: z.string().max(200).regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/).default("/app"),
});

/** The price is always computed on the server; the client only names the plan. */
export const POST = (req: Request) =>
  billingRoute(req, Body, async (env, account, input) => {
    const r = await createCheckout(env, account.accountId, input);
    return Response.json({ checkoutUrl: r.checkoutUrl, purchaseId: r.purchaseId, plan: r.plan, founding: r.founding, price: { ...r.price, currency: "PLN" } });
  });
