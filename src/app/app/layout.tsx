import { redirect } from "next/navigation";
import { getEnv } from "@/lib/server/env";
import { getOnboarding } from "@/lib/server/onboarding";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { GoSignIn } from "@/components/auth/GoSignIn";
import { currentAccount } from "@/lib/server/account";

export const metadata: Metadata = { title: "My case", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every /app page needs an account: no valid session goes to sign-in with ?next=, before any app code runs. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  if (!account) return <GoSignIn />;
  const onboarding = await getOnboarding(getEnv(), account.accountId);
  if (onboarding.status !== "completed") redirect("/onboarding");
  return (
    <AppShell>
      {children}
    </AppShell>
  );
}
