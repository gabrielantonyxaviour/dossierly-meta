import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { Suspense } from "react";
import { AgentChat } from "@/components/app/chat/AgentChat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("chat");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <Suspense><AgentChat /></Suspense>;
}
