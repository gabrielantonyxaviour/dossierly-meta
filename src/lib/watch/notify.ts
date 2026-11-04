import { z } from "zod";
import * as twilio from "../voice/server/twilio";
import type { Env } from "../server/env";

export type LetterCallInput = { title: string; sender: string; asks: string; dueDate: string; deadlineId?: string; prepared: string[] };
type LetterCaller = (env: Env, a: { accountId: string; userId: string; letter: LetterCallInput }) => Promise<{ callSid: string; to: string }>;

/** Calls about the letter: the voice pane's callAboutLetter when it exists, else a plain placeCall with the same facts as the reason. */
export async function callAboutLetter(env: Env, a: { accountId: string; userId: string; letter: LetterCallInput }): Promise<{ callSid: string; to: string }> {
  const fn = (twilio as unknown as { callAboutLetter?: LetterCaller }).callAboutLetter;
  if (typeof fn === "function") return fn(env, a);
  const l = a.letter;
  const prepared = l.prepared.length ? ` Prepared: ${l.prepared.join("; ")}.` : "";
  const reason = `Another letter just came in from ${l.sender || "the office"}: ${l.asks || l.title} by ${l.dueDate}.${prepared}`;
  return twilio.placeCall(env, { accountId: a.accountId, userId: a.userId, reason });
}

type EmailBinding = { send(m: { to: string; from: { email: string; name: string }; subject: string; html: string; text: string }): Promise<{ messageId: string }> };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FROM = "no-reply@dossierly.cosmiclan.com";

/** One short notice with the title and date and a link into the app. Never the letter itself. Silent when the binding is missing. */
export async function sendLetterEmail(env: Env, to: string, a: { title: string; dueDate: string | null }): Promise<boolean> {
  const binding = (env as unknown as { EMAIL?: EmailBinding }).EMAIL;
  if (!binding || typeof binding.send !== "function") return false;
  const from = z.email().safeParse(env.EMAIL_FROM).success ? String(env.EMAIL_FROM) : FROM;
  const link = `${env.APP_URL}/app`;
  const due = a.dueDate ? ` Due date: ${a.dueDate}.` : "";
  const text = `A new letter from the office was added to your case: ${a.title}.${due}\n\nOpen your case: ${link}\n\nThis is a reminder, not legal advice.`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#202522;"><div style="max-width:480px;margin:0 auto;padding:32px 16px;"><div style="font-size:20px;font-weight:700;padding-bottom:20px;">Dossierly<span style="color:#527568;">.</span></div><div style="background:#fff;border:1px solid #e1e5e0;border-radius:12px;padding:28px 24px;"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">New letter from the office</h1><p style="margin:0 0 8px;font-size:16px;line-height:1.6;">${esc(a.title)}</p>${a.dueDate ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#505953;">Due date: <strong>${esc(a.dueDate)}</strong></p>` : ""}<a href="${esc(link)}" style="display:inline-block;background:#233f32;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;">Open your case</a></div><p style="font-size:13px;color:#626b65;padding:16px 4px 0;">This is a reminder, not legal advice.</p></div></body></html>`;
  try {
    const r = await binding.send({ to, from: { email: from, name: "Dossierly" }, subject: `New letter from the office: ${a.title}`.slice(0, 200), html, text });
    return !!r?.messageId;
  } catch {
    return false;
  }
}
