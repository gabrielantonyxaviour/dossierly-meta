import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { VisitPlanFlow } from "@/components/app/visit/VisitPlanFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("visit");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <VisitPlanFlow />;
}
