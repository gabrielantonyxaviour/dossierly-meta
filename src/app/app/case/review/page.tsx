import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ReviewScreen } from "@/components/app/review/ReviewScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("review");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <ReviewScreen />;
}
