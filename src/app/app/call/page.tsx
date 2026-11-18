import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { CallScreen } from "@/components/voice/CallScreen";
import { getEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("voice");
  return { title: t("metaTitle") };
}

/** /app/call: the caseworker call. ?mode=welcome (preview/local only, 404 in production) replays onboarding's welcome call on the current case. */
export default async function Page({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  if (mode === "welcome") {
    if (getEnv().APP_ENV === "production") notFound();
    return <CallScreen welcome />;
  }
  return <CallScreen />;
}
