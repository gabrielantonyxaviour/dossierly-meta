import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/components/app/plan/PlanScreen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("plan");
  return { title: t("title") };
}

export default function Plan() {
  return <Suspense><PlanScreen /></Suspense>;
}
