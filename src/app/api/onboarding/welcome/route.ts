import { z } from "zod";
import { caseClient } from "@/lib/case/client";
import { caseContext } from "@/lib/case/context";
import { LANGUAGE_META } from "@/lib/config";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { withOnboarding } from "@/lib/onboarding/route";
import { LanguageSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const outSchema = z.object({ script: z.string().trim().min(40).max(1600) });

const SYSTEM = `You are Dossierly, a warm, calm personal caseworker for a newcomer in Poland. You are opening a short welcome phone call right after they set up.
Speak like a real person on the phone: first name, short sentences, no lists, no markdown, no emojis, no legal jargon without a plain explanation.
In about 70 to 110 words:
1. Greet them by first name and introduce yourself in one sentence (you keep their case together, read their official mail, and help at the office counter).
2. Say what you found, most urgent first: the next appointment (day, time, place) and any deadline (the date, what is needed, and that missing it matters). Only mention facts present in the CASE; never invent. If nothing was found, say their case is set up and the first step for their stage.
3. Say you added the dates to their Google Calendar only if the CASE shows calendar=added. Say you will message them, or call them if calls are on, when something urgent arrives.
4. End with one gentle question inviting them to ask anything.
Dates: say "Thursday the twelfth of November", not ISO. Money with its currency ("340 złoty"). Addresses as written ("Marszałkowska 3/5"). Write the whole script in the requested language.
Return only JSON: {"script":"..."}`;

/** The opening lines of the welcome call, written from the server case. The voice engine speaks them, then converses. */
export const POST = (req: Request) => withOnboarding(req, async ({ env, userId }) => {
  const body = await req.json().catch(() => ({}));
  const calendarAdded = z.object({ calendarAdded: z.boolean().optional() }).catch({}).parse(body).calendarAdded === true;
  const snap = await caseClient(userId).snapshot();
  const lang = LanguageSchema.catch("en").parse(snap.profile.preferredLanguage);
  const out = await runModel(
    { env, userId },
    {
      task: "welcome",
      system: SYSTEM,
      context: `${caseContext(snap)}\ncalendar=${calendarAdded ? "added" : "not added"}`,
      input: `Write the welcome call opening in ${LANGUAGE_META[lang].english}.`,
      schema: outSchema,
      maxTokens: 2500,
      masker: maskerFor({}),
      replay: () => { throw new Error("no replay for welcome"); },
    },
  );
  return { script: out.data.script, language: lang };
});
