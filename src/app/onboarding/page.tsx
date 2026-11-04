import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { caseClient } from "@/lib/case/client";
import { currentAccount } from "@/lib/server/account";
import { getEnv } from "@/lib/server/env";
import { freshFirstRun } from "@/lib/dev/fresh";
import { getOnboarding, restartOnboarding } from "@/lib/server/onboarding";
import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import "./flow.css";
import "./inbox.css";

export const metadata: Metadata = { title: "Set up your case", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** New accounts onboard, unfinished setups resume at their step, completed ones go to their case. */
export default async function Page({ searchParams }: { searchParams: Promise<{ connection?: string; again?: string; fresh?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect("/signin?next=%2Fonboarding");
  const env = getEnv();
  // Previews: ?fresh=1 is a true first run (empty case, Google disconnected). Production ignores it.
  if ((await searchParams).fresh === "1" && env.APP_ENV !== "production") {
    await freshFirstRun(env, account.accountId, { disconnect: true });
    redirect("/onboarding");
  }
  const [initial, snapshot, identity] = await Promise.all([
    getOnboarding(env, account.accountId),
    caseClient(account.accountId).snapshot(),
    env.DB.prepare("SELECT email FROM email_identities WHERE user_id=? AND verified_at>0").bind(account.accountId).first<{ email: string }>(),
  ]);
  // A setup marked complete without the answers behind it (e.g. an older build) is set up again.
  const { connection, again } = await searchParams;
  const answered = !!snapshot.profile.fullName && !!snapshot.profile.permitType;
  if (initial.status === "completed" && answered && again !== "1") redirect("/app");
  // ?again=1 walks the setup again from step 1 with every answer pre-filled (review and demo runs).
  const state = initial.status === "completed" || again === "1" ? await restartOnboarding(env, account.accountId) : initial;
  const returned = connection === "connected" || connection === "failed" ? connection : null;
  return <OnboardingFlow initial={state} profile={snapshot.profile} email={identity?.email ?? null} returned={returned} />;
}
