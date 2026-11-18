import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { CaseScreen } from "@/components/app/case/CaseScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("case");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <Suspense><CaseScreen /></Suspense>;
}
