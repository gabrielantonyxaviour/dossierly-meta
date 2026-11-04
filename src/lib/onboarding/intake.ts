import { z } from "zod";
import { caseClient } from "../case/client";
import type { Profile } from "../case/types";
import { maskerFor } from "../mask";
import { runModel } from "../model";
import { LANGUAGES, type Language } from "../schemas";
import type { Env } from "../server/env";
import { speakAll } from "../voice/server/tts";
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

export type IntakeResult = { reply: string; language: string; audio: string | null; profile: Profile; firstName: string | null };

/** Reads the transcript, saves what it states to the profile, and returns the spoken reply (PCM16 16 kHz, base64). */
export async function runIntake(env: Env, userId: string, transcript: string): Promise<IntakeResult> {
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
  return { reply: x.reply, language: lang ?? "en", audio: await speech(env, x.reply, lang ?? "en"), profile, firstName: x.firstName };
}

async function speech(env: Env, text: string, lang: string): Promise<string | null> {
  const key = String((env as unknown as Record<string, unknown>).ELEVENLABS_API_KEY ?? "");
  if (!key) return null;
  try {
    const pcm = await speakAll(key, { text, lang, voice: "dossierly", format: "pcm_16000" });
    let bin = "";
    for (let i = 0; i < pcm.length; i += 0x8000) bin += String.fromCharCode(...pcm.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null; // the reply still shows as text
  }
}
