import { redirect } from "next/navigation";
import { getEnv } from "@/lib/server/env";
import { getOnboarding } from "@/lib/server/onboarding";
import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { GoSignIn } from "@/components/auth/GoSignIn";
import { currentAccount } from "@/lib/server/account";
import { ensurePreviewCase, previewFlow } from "@/lib/dev/preview";

export const metadata: Metadata = { title: "My case", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Every /app page needs an account: no valid session goes to sign-in with ?next=, before any app code runs. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const account = await currentAccount();
  if (!account) return <GoSignIn />;
  const env = getEnv();
  const onboarding = await getOnboarding(env, account.accountId);
  let completed = onboarding.status === "completed";
  // app/voice/look previews: an empty case gets Arjun's labelled sample case and setup is skipped (never production).
  const flow = previewFlow(env);
  if (flow && flow !== "onboarding") {
    try {
      if (await ensurePreviewCase(env, account.accountId, completed)) completed = true;
    } catch {
      /* seeding is best effort; the normal path below still applies */
    }
  }
  if (!completed) redirect("/onboarding");
  return <AppShell>{children}</AppShell>;
}
