import { z } from "zod";
import { getEnv, type Env } from "@/lib/server/env";
import { ApiError, errorResponse, readJson, jsonError } from "@/lib/server/http";
import { accountFromCookie } from "@/lib/server/session";
import { timingSafeEqual } from "@/lib/server/util";
import { publicCatalogue, sampleLetterById, SAMPLE_ADMIN_ALLOWLIST, SAMPLE_SENDER, type SampleLetter } from "@/lib/features/letters-samples";

export const dynamic = "force-dynamic";

const Body = z.object({ id: z.string().min(1).max(60), to: z.string().max(200).optional() });
const DAILY_LIMIT = 6;

type Attachment = { filename: string; content: Uint8Array; type: string; disposition: "attachment" };
type EmailBinding = { send(m: Record<string, unknown>): Promise<{ messageId: string }> };

export async function GET() {
  return Response.json(publicCatalogue());
}

/** Recipient: admin token path (allowlist only) or the signed-in account's own verified email. */
async function resolveRecipient(req: Request, env: Env, to?: string): Promise<{ email: string; name?: string; limitKey: string | null }> {
  const token = req.headers.get("x-sample-token");
  const secret = (env as unknown as { SAMPLE_MAIL_TOKEN?: string }).SAMPLE_MAIL_TOKEN;
  if (token !== null) {
    if (!secret || !timingSafeEqual(token, secret)) throw new ApiError(401, "Sample mail token not accepted", "sample_token_invalid");
    const addr = (to ?? "").trim().toLowerCase();
    const name = Object.hasOwn(SAMPLE_ADMIN_ALLOWLIST, addr) ? SAMPLE_ADMIN_ALLOWLIST[addr] : undefined;
    if (!name) throw new ApiError(400, "Recipient is not on the sample allowlist", "recipient_not_allowed");
    return { email: addr, name, limitKey: null };
  }
  const account = await accountFromCookie(req.headers.get("cookie"), env);
  if (!account) throw new ApiError(401, "No active session", "no_session");
  const row = await env.DB.prepare("SELECT email FROM email_identities WHERE user_id = ? ORDER BY verified_at LIMIT 1")
    .bind(account.accountId).first<{ email: string }>();
  if (!row?.email) throw new ApiError(400, "Your account has no verified email to send the sample to", "no_account_email");
  return { email: row.email, limitKey: `samplemail:${account.accountId}:${new Date().toISOString().slice(0, 10)}` };
}

async function overLimit(env: Env, key: string): Promise<boolean> {
  const n = Number((await env.CACHE.get(key)) ?? "0");
  if (n >= DAILY_LIMIT) return true;
  await env.CACHE.put(key, String(n + 1), { expirationTtl: 60 * 60 * 26 });
  return false;
}

/** Bytes from the ASSETS binding when bound, else `${APP_URL}${path}`. */
async function fetchBytes(env: Env, req: Request, path: string): Promise<Uint8Array | null> {
  try {
    const assets = (env as unknown as { ASSETS?: { fetch(r: Request): Promise<Response> } }).ASSETS;
    const res = assets
      ? await assets.fetch(new Request(`${new URL(req.url).origin}${path}`))
      : await fetch(`${env.APP_URL || new URL(req.url).origin}${path}`);
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function attachments(env: Env, req: Request, l: SampleLetter): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (const [path, type] of [[l.pdf, "application/pdf"], [l.png, "image/png"]] as const) {
    const content = await fetchBytes(env, req, path);
    if (content) out.push({ filename: path.split("/").pop() as string, content, type, disposition: "attachment" });
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const env = getEnv();
    const { id, to } = await readJson(req, Body);
    const letter = sampleLetterById(id);
    if (!letter) throw new ApiError(400, "Unknown sample id", "unknown_sample");
    const binding = (env as unknown as { EMAIL?: EmailBinding }).EMAIL;
    if (!binding || typeof binding.send !== "function") throw new ApiError(503, "Email delivery is unavailable", "email_unavailable");
    const rcpt = await resolveRecipient(req, env, to);
    if (rcpt.limitKey && (await overLimit(env, rcpt.limitKey))) throw new ApiError(429, "Daily sample email limit reached", "rate_limited");
    const atts = await attachments(env, req, letter);
    const origin = env.APP_URL || new URL(req.url).origin;
    const links = [letter.pdf, letter.png].map((p) => `${origin}${p}`);
    const html = `${letter.email.html}<p style="font-size:13px"><a href="${links[0]}">PDF</a> · <a href="${links[1]}">PNG</a></p>`;
    const text = `${letter.email.text}\n\nPDF: ${links[0]}\nPNG: ${links[1]}`;
    const send = (list: Attachment[]) => binding.send({
      to: rcpt.name ? { email: rcpt.email, name: rcpt.name } : rcpt.email,
      from: SAMPLE_SENDER, subject: letter.email.subject, html, text,
      headers: { "X-Entity-Ref-ID": `dossierly-sample/${letter.id}` },
      ...(list.length ? { attachments: list } : {}),
    });
    let result: { messageId: string };
    try {
      result = await send(atts);
    } catch (e) {
      if (!atts.length) throw e;
      result = await send([]); // attachments rejected: links in the body still carry the files
    }
    return Response.json({ ok: true, messageId: result.messageId, id: letter.id, attachments: atts.length });
  } catch (e) {
    if (e instanceof ApiError || e instanceof z.ZodError) return errorResponse(e);
    return jsonError(502, "Could not send the sample email", "email_failed");
  }
}
