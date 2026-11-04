import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { caseClient } from "@/lib/case/client";
import { currentAccount } from "@/lib/server/account";
import { getEnv } from "@/lib/server/env";
import { getOnboarding } from "@/lib/server/onboarding";
import { OnboardingFlow } from "@/components/onboarding/flow/OnboardingFlow";
import "./flow.css";
import "./inbox.css";

export const metadata: Metadata = { title: "Set up your case", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** New accounts onboard, unfinished setups resume at their step, completed ones go to their case. */
export default async function Page({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const account = await currentAccount();
  if (!account) redirect("/signin?next=%2Fonboarding");
  const env = getEnv();
  const [initial, snapshot, identity] = await Promise.all([
    getOnboarding(env, account.accountId),
    caseClient(account.accountId).snapshot(),
    env.DB.prepare("SELECT email FROM email_identities WHERE user_id=? AND verified_at>0").bind(account.accountId).first<{ email: string }>(),
  ]);
  if (initial.status === "completed") redirect("/app");
  const connection = (await searchParams).connection;
  const returned = connection === "connected" || connection === "failed" ? connection : null;
  return <OnboardingFlow initial={initial} profile={snapshot.profile} email={identity?.email ?? null} returned={returned} />;
}
