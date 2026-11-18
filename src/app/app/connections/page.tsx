import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionsScreen } from "@/components/app/connections/ConnectionsScreen";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("connections");
  return { title: t("metaTitle") };
}

export default function ConnectionsPage() {
  return <Suspense><ConnectionsScreen /></Suspense>;
}
