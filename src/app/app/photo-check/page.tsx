import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { PhotoFlow } from "@/components/app/photo/PhotoFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("photo");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <PhotoFlow />;
}
