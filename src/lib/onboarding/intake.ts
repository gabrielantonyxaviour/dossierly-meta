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
  officialMail: z.boolean().catch(false),
  reply: z.string().trim().min(2).max(240),
});

const SYSTEM = `You are Dossierly, a calm personal caseworker for newcomers in Poland. This is the very first moment of setup: the person just pressed the microphone and said a few words about themselves. You hear a speech transcript (it may contain fillers, false starts and self-corrections).
Pull out only what they actually said:
- firstName and fullName (fullName only if they said a surname), as they would write them.
- language: ISO code of the language they spoke (en, uk, ru, hi, ta, zh, ja, vi, pl…).
- reason for living in Poland: study (student, university), work (job, employer), family, other, or unknown.
- city in Poland if they named one.
- officialMail: true if they mention a letter, a summons, an office, an appointment, fingerprints, a permit or a deadline.
Then write reply: what you say back out loud, in the language they spoke, at most two very short spoken sentences (under 20 words). Greet them by first name. If officialMail is true, ask to look at their email and say why in a few words: that is where the office writes to them. Otherwise ask to look at their email so you can find anything official. Do not answer their questions yet, do not repeat their details back, do not mention dates, and do not promise outcomes. No emojis, no lists.
Example. Transcript: "um hello I'm Mei, I work here, and I got some letter from the office I don't get" → reply: "Hi Mei. Can I look at your email? That's where the office writes to you."
Return only JSON: {"firstName":null,"fullName":null,"language":"en","reason":"unknown","city":null,"officialMail":false,"reply":""}`;

const PERMIT: Record<string, Profile["permitType"]> = { study: "temporary_residence_study", work: "temporary_residence_work", family: "other", other: "other" };

export type IntakeResult = { reply: string; language: string; speechId: string | null; profile: Profile; firstName: string | null };

/** Reads the transcript, saves what it states to the profile, and returns the reply plus a speech id to stream it. */
export async function runIntake(env: Env, userId: string, transcript: string): Promise<IntakeResult> {
  const t = await intakeTurn(env, userId, transcript);
  return { ...t, speechId: await queueSpeech(env, userId, t.reply, t.language) };
}

/** One spoken introduction → saved profile + the reply to say. Also used by the realtime voice session (mode "intake"). */
export async function intakeTurn(env: Env, userId: string, transcript: string): Promise<Omit<IntakeResult, "speechId">> {
  const out = await retryTransient(() => runModel(
    { env, userId },
    {
      task: "intake", system: SYSTEM, input: `Transcript: "${transcript.replace(/"/g, "'")}"`, schema: outSchema,
      maxTokens: 800, effort: "minimal", masker: maskerFor({}), replay: () => { throw new Error("no replay for intake"); },
    },
  ));
  const x = out.data;
  const c = caseClient(userId);
  const current = (await c.snapshot()).profile;
  const lang = (LANGUAGES as readonly string[]).includes(x.language) ? (x.language as Language) : null;
  const patch: Partial<Profile> = { country: "PL" };
  const name = x.fullName ?? x.firstName;
  if (name && (!current.fullName || !current.fullName.toLowerCase().startsWith(name.toLowerCase()))) patch.fullName = name;
  if (lang) patch.preferredLanguage = lang;
  if (PERMIT[x.reason]) patch.permitType = PERMIT[x.reason];
  if (x.city) patch.city = x.city;
  const profile = await c.patchProfile(patch);
  return { reply: x.reply, language: lang ?? "en", profile, firstName: x.firstName };
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
