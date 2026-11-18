import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { CounterHub } from "@/components/app/counter/CounterHub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("counter");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <CounterHub />;
}
