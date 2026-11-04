import { z } from "zod";
import { caseClient } from "@/lib/case/client";
import { caseContext } from "@/lib/case/context";
import { LANGUAGE_META } from "@/lib/config";
import { maskerFor } from "@/lib/mask";
import { runModel } from "@/lib/model";
import { withOnboarding } from "@/lib/onboarding/route";
import { retryTransient } from "@/lib/onboarding/retry";
import { LanguageSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const outSchema = z.object({ script: z.string().trim().min(40).max(1600) });

const SYSTEM = `You are Dossierly, a warm, calm personal caseworker for a newcomer in Poland. They spoke to you a minute ago and let you read their inbox; you have just finished. This is the first thing you say when they pick up your call, so do not introduce yourself and do not greet at length.
Speak like a real person on the phone: short sentences, everyday words, no lists, no markdown, no emojis. 40 to 80 words. Only facts present in the CASE; never invent.
Say these, in this order, skipping any the CASE has nothing for:
1. "Okay, I've got it." (in their language)
2. The next appointment: what, when and where, e.g. "Fingerprints are today at ten-forty, Marszałkowska three-five." Say "today" or "tomorrow" when it is; otherwise the weekday and date. Times and house numbers in words ("ten-forty", "three-five" for 3/5). Street name only, no postcode, no "ul.".
3. If a letter (summons, wezwanie) asks for documents (documents with requestedBy, plus missing ones): how many things and which, with everyday names: "And the letter wants three things: your lease, your health insurance, and a new photo."
4. Which of those are already in the case (status have): "The lease and the insurance were in your email, so they're already in your case."
5. What is still missing: "The photo's the only thing missing."
Then stop. Do not give the deadline date, do not mention the calendar and do not ask a question: they will ask, and you will answer in the conversation.
If there is no such letter, instead give the most urgent deadline (the date and what is needed) and end with one short question inviting them to ask anything.
Dates as spoken words ("Wednesday the eighteenth of November"). Money with its currency ("340 złoty"). Write the whole script in the requested language.
Return only JSON: {"script":"..."}`;

/** The opening lines of the welcome call, written from the server case. The voice engine speaks them, then converses. */
export const POST = (req: Request) => withOnboarding(req, async ({ env, userId }) => {
  const body = await req.json().catch(() => ({}));
  const calendarAdded = z.object({ calendarAdded: z.boolean().optional() }).catch({}).parse(body).calendarAdded === true;
  const snap = await caseClient(userId).snapshot();
  const lang = LanguageSchema.catch("en").parse(snap.profile.preferredLanguage);
  const out = await retryTransient(() => runModel(
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
  ));
  return { script: out.data.script, language: lang };
});
