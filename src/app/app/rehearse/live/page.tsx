import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { RehearseFlow } from "@/components/app/rehearse/RehearseFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("rehearse");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <RehearseFlow />;
}
