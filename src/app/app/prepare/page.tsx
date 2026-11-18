import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { PrepareFlow } from "@/components/app/prepare/PrepareFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("prepare");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <PrepareFlow />;
}
