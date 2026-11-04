import { z } from "zod";
import { caseClient } from "../case/client";
import type { Profile } from "../case/types";
import { maskerFor } from "../mask";
import { runModel } from "../model";
import { LANGUAGES, type Language } from "../schemas";
import type { Env } from "../server/env";
import { speak } from "../voice/server/tts";
import { retryTransient } from "./retry";

/* Voice-first setup: the person says who they are in their own words; Spark pulls out the profile and answers out loud. */

export const intakeSchema = z.object({ transcript: z.string().trim().min(2).max(1500) }).strict();

const n = <T extends z.ZodTypeAny>(s: T) => s.nullable().catch(null);
const outSchema = z.object({
  firstName: n(z.string().trim().min(1).max(60)),
  fullName: n(z.string().trim().min(2).max(120)),
  language: z.string().trim().max(8).catch("en"),
  reason: z.enum(["study", "work", "family", "other", "unknown"]).catch("unknown"),
  city: n(z.string().trim().min(2).max(80)),
});
const replySchema = z.object({ reply: z.string().trim().min(2).max(240), language: z.string().trim().max(8).catch("en") });

/* Two Spark calls in parallel: the spoken reply (short prompt, tiny output, on the critical path) and the profile. */
const EXTRACT = `You read the speech transcript of a newcomer in Poland introducing themselves at the start of setup (it may contain fillers, false starts and self-corrections). Pull out only what they actually said:
- firstName and fullName (fullName only if they said a surname), as they would write them.
- language: ISO code of the language they spoke (en, uk, ru, hi, ta, zh, ja, vi, pl…).
- reason for living in Poland: study (student, university), work (job, employer), family, other, or unknown.
- city in Poland if they named one.
Return only JSON: {"firstName":null,"fullName":null,"language":"en","reason":"unknown","city":null}`;

const REPLY_RULES = `You are Dossierly, a calm caseworker for newcomers in Poland. The person just introduced themselves by voice (speech transcript, may have fillers). Say back, in the language they spoke, at most two very short spoken sentences (under 20 words): greet them by first name, then ask to look at their email and say why in a few words (that is where the office writes to them). Do not answer questions yet, repeat their details, mention dates or promise outcomes. No emojis.`;
const REPLY = `${REPLY_RULES}
Example: "um hello I'm Mei, I work here, I got some letter from the office I don't get" → {"reply":"Hi Mei. Can I look at your email? That's where the office writes to you.","language":"en"}
Return only JSON: {"reply":"","language":"<ISO code of the language they spoke>"}`;

/** Same reply as a streamable line format, for the realtime voice session (first sentence goes to TTS as it arrives). */
export const INTAKE_REPLY_SYSTEM = `${REPLY_RULES}
Example: "um hello I'm Mei, I work here, I got some letter from the office I don't get" →
SAY: Hi Mei. Can I look at your email? That's where the office writes to you.
LANG: en
Reply in exactly this line format:
SAY: <reply>
LANG: <ISO code of the language they spoke>`;
/** The user message for INTAKE_REPLY_SYSTEM and the extraction. */
export const intakeInput = (transcript: string) => `Transcript: "${transcript.replace(/"/g, "'")}"`;

type CaseNs = { idFromName(n: string): unknown; get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> } };
/** The profile through the CASE_DO binding on whatever env is given (Next route or VoiceDO), else the dev case client. */
function profileStore(env: Env, userId: string): { get(): Promise<Profile>; patch(p: Partial<Profile>): Promise<Profile> } {
  const ns = (env as unknown as { CASE_DO?: CaseNs }).CASE_DO;
  if (!ns) {
    const c = caseClient(userId);
    return { get: async () => (await c.snapshot()).profile, patch: (p) => c.patchProfile(p) };
  }
  const stub = ns.get(ns.idFromName(userId));
  const call = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
    const r = await stub.fetch(`https://case.do/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }) });
    if (!r.ok) throw new Error("case_unavailable");
    return (await r.json()) as T;
  };
  return { get: async () => (await call<{ profile: Profile }>("snapshot", "GET")).profile, patch: (p) => call<Profile>("profile", "PATCH", p) };
}

const PERMIT: Record<string, Profile["permitType"]> = { study: "temporary_residence_study", work: "temporary_residence_work", family: "other", other: "other" };

export type IntakeResult = { reply: string; language: string; speechId: string | null; profile: Profile; firstName: string | null };

/** Reads the transcript, saves what it states to the profile, and returns the reply plus a speech id to stream it. */
export async function runIntake(env: Env, userId: string, transcript: string): Promise<IntakeResult> {
  const t = await intakeTurn(env, userId, transcript);
  return { ...t, speechId: await queueSpeech(env, userId, t.reply, t.language) };
}

const base = (input: string) => ({ input, effort: "minimal" as const, masker: maskerFor({}), replay: (): never => { throw new Error("no replay for intake"); } });
/** Spark spends reasoning tokens even at "minimal": a low cap returns empty content. */
const MAX_TOKENS = 1200;

/**
 * The profile half of the intake: Spark extracts name, permit, language and city, and the case profile is saved
 * (in the background when `defer` is given; the returned profile is then current + patch). Used on its own by the
 * realtime voice session, which streams the reply itself with INTAKE_REPLY_SYSTEM.
 */
export async function intakeProfile(env: Env, userId: string, transcript: string, opts: { defer?: (work: Promise<unknown>) => void } = {}) {
  const c = profileStore(env, userId);
  const [out, current] = await Promise.all([
    retryTransient(() => runModel({ env, userId }, { ...base(intakeInput(transcript)), task: "intake", system: EXTRACT, schema: outSchema, maxTokens: MAX_TOKENS }), 600),
    c.get(),
  ]);
  const x = out.data;
  const lang = (LANGUAGES as readonly string[]).includes(x.language) ? (x.language as Language) : null;
  const patch: Partial<Profile> = { country: "PL" };
  const name = x.fullName ?? x.firstName;
  if (name && (!current.fullName || !current.fullName.toLowerCase().startsWith(name.toLowerCase()))) patch.fullName = name;
  if (lang) patch.preferredLanguage = lang;
  if (PERMIT[x.reason]) patch.permitType = PERMIT[x.reason];
  if (x.city) patch.city = x.city;
  const meta = { firstName: x.firstName, language: lang };
  if (opts.defer) {
    opts.defer(c.patch(patch).catch(() => undefined));
    return { ...meta, profile: { ...current, ...patch, phone: current.phone } as Profile };
  }
  return { ...meta, profile: await c.patch(patch) };
}

/**
 * One spoken introduction → the reply to say + the saved profile, as two parallel Spark calls. `onReply` gets the
 * reply the moment it exists, before the profile half finishes.
 */
export async function intakeTurn(
  env: Env, userId: string, transcript: string,
  opts: { defer?: (work: Promise<unknown>) => void; onReply?: (reply: string, language: string) => void } = {},
): Promise<Omit<IntakeResult, "speechId">> {
  const replyP = retryTransient(() => runModel({ env, userId }, { ...base(intakeInput(transcript)), task: "intake", system: REPLY, schema: replySchema, maxTokens: MAX_TOKENS }), 600).then((o) => {
    const lang = (LANGUAGES as readonly string[]).includes(o.data.language) ? o.data.language : "en";
    opts.onReply?.(o.data.reply, lang);
    return { reply: o.data.reply, language: lang };
  });
  const [said, p] = await Promise.all([replyP, intakeProfile(env, userId, transcript, { defer: opts.defer })]);
  return { reply: said.reply, language: p.language ?? said.language, firstName: p.firstName, profile: p.profile };
}

const speechKey = (userId: string, id: string) => `obvoice:${userId}:${id}`;
const hasTts = (env: Env) => !!String((env as unknown as Record<string, unknown>).ELEVENLABS_API_KEY ?? "");

/** The reply is spoken by a separate streamed request (first audio in ~0.3 s); only this user can fetch it, for 5 minutes. */
async function queueSpeech(env: Env, userId: string, text: string, lang: string): Promise<string | null> {
  if (!hasTts(env)) return null;
  const id = crypto.randomUUID();
  await env.CACHE.put(speechKey(userId, id), JSON.stringify({ text, lang }), { expirationTtl: 300 });
  return id;
}

/** Raw PCM16 16 kHz mono, streamed from ElevenLabs as it is produced. */
export async function speechStream(env: Env, userId: string, id: string): Promise<ReadableStream<Uint8Array> | null> {
  const raw = await env.CACHE.get(speechKey(userId, id));
  if (!raw) return null;
  const { text, lang } = z.object({ text: z.string().max(400), lang: z.string().max(8) }).parse(JSON.parse(raw));
  const key = String((env as unknown as Record<string, unknown>).ELEVENLABS_API_KEY ?? "");
  const parts = speak(key, { text, lang, voice: "dossierly", format: "pcm_16000" });
  return new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      try {
        const { done, value } = await parts.next();
        if (done) ctrl.close(); else ctrl.enqueue(value);
      } catch {
        ctrl.close(); // the caption is already on screen
      }
    },
  });
}
