import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { MosSheet } from "@/components/app/mos/MosSheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("mos");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <MosSheet />;
}
