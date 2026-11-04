import { listOfficialMail } from "@/lib/onboarding/inbox";
import { withOnboarding } from "@/lib/onboarding/route";

export const dynamic = "force-dynamic";

/** Candidate official emails (metadata only) from the connected Gmail account. */
export const GET = (req: Request) => withOnboarding(req, ({ env, accountId }) => listOfficialMail(env, accountId));
