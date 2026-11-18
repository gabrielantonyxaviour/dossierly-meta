import { readLetter } from "@/lib/features/letters";
import { handle } from "@/lib/features/route";
import { LettersReadRequestSchema } from "@/lib/schemas";
import { assertCanReadLetter, spendLetter } from "@/lib/server/entitlements";
import { loadUserState, SAMPLE_USER_ID } from "@/lib/server/session";

export const maxDuration = 60;

/**
 * Free accounts read FREE_LETTERS letters over their lifetime; a live One case or Household year
 * (and judge plans) is unlimited; the SAMPLE case is exempt. Nothing is spent on an unreadable photo.
 */
export async function POST(request: Request) {
  return handle(request, LettersReadRequestSchema, async (ctx, input, userId) => {
    // The shared SAMPLE case is a demo for every visitor; the daily model budget caps its cost.
    const state = await loadUserState(ctx.env, userId);
    const isSample = userId === SAMPLE_USER_ID || state?.activeCase === "sample";
    if (!isSample && state && state.plan.kind !== "judge") await assertCanReadLetter(ctx.env, userId, state.lettersUsed);
    const result = await readLetter(ctx, input);
    if (isSample || !result.letter.readable) return result;
    await spendLetter(ctx.env, userId);
    return result;
  });
}
