import type { Metadata } from "next";
import { SettingsScreen } from "@/components/app/settings/SettingsScreen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("settings");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <SettingsScreen />;
}
