import { commitFindings, commitSchema } from "@/lib/onboarding/commit";
import { withOnboarding } from "@/lib/onboarding/route";
import { readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Saves the findings the user confirmed into the case, and optionally adds the dated ones to Google Calendar. */
export const POST = (req: Request) => withOnboarding(req, async ({ env, userId, accountId }) => commitFindings(env, { userId, accountId }, await readJson(req, commitSchema)));
