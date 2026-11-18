import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/app/plan/PlanScreen";
import { GoSignIn } from "@/components/auth/GoSignIn";
import { currentAccount } from "@/lib/server/account";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("plan");
  return { title: t("title"), robots: { index: false } };
}

export const dynamic = "force-dynamic";

/** Outside /app on purpose: someone arriving from pricing can pay before finishing onboarding. Still needs a session. */
export default async function Plan() {
  if (!(await currentAccount())) return <GoSignIn />;
  return <main className="pl-root"><Suspense><PlanScreen /></Suspense></main>;
}
