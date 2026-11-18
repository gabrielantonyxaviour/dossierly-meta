import type { Metadata } from "next";
import { HelpPage } from "@/components/app/help/HelpPage";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("help");
  return { title: t("metaTitle") };
}

export default function Help() {
  return <HelpPage />;
}
