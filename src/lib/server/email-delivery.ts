import { z } from "zod";
import type { Env } from "./env";
import { ApiError } from "./http";
import { emailCodeTemplate } from "./email-code-template";

export type SendCode = (email: string, code: string, challengeId: string) => Promise<void>;

type EmailAddress = { email: string; name?: string };
type EmailBinding = {
  send(message: {
    to: string | EmailAddress;
    from: string | EmailAddress;
    subject: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
};

const DEFAULT_FROM = "no-reply@dossierly.cosmiclan.com";

/** Cloudflare Email Service `send_email` binding (named EMAIL in wrangler.jsonc). */
function emailBinding(env: Env): EmailBinding | undefined {
  const binding = (env as unknown as { EMAIL?: EmailBinding }).EMAIL;
  return binding && typeof binding.send === "function" ? binding : undefined;
}

function sender(env: Env): string {
  const from = env.EMAIL_FROM ?? DEFAULT_FROM;
  return z.email().safeParse(from).success ? from : DEFAULT_FROM;
}

export function requireEmailDelivery(env: Env) {
  if (!emailBinding(env)) {
    throw new ApiError(503, "Email sign-in is temporarily unavailable. Please try again later.", "email_unavailable");
  }
}

/** Transactional sign-in codes only. Never logs recipient, code, or provider error bodies. */
export async function sendEmailCode(env: Env, email: string, code: string, challengeId: string): Promise<void> {
  requireEmailDelivery(env);
  const binding = emailBinding(env) as EmailBinding;
  try {
    const result = await binding.send({
      to: email,
      from: { email: sender(env), name: "Dossierly" },
      subject: "Your Dossierly sign-in code",
      headers: { "X-Entity-Ref-ID": `dossierly-signin/${challengeId}` },
      ...emailCodeTemplate(code),
    });
    if (!result?.messageId) throw new Error("delivery_failed");
  } catch {
    throw new ApiError(503, "We could not send your code. Please try again later.", "email_unavailable");
  }
}
