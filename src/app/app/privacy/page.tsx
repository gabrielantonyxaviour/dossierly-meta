import type { Metadata } from "next";
import { PrivacyScreen } from "@/components/app/privacy/PrivacyScreen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("privacy");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <PrivacyScreen />;
}
