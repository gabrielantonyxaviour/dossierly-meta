import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { CounterFlow } from "@/components/app/counter/CounterFlow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("counter");
  return { title: t("metaTitleLive") };
}

export default function Page() {
  return <CounterFlow />;
}
