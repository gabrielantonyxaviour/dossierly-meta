import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("connections");
  return { title: t("metaTitle") };
}

export default function ConnectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
