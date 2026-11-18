import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { ReadyScreen } from "@/components/app/ready/ReadyScreen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("ready");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <ReadyScreen />;
}
