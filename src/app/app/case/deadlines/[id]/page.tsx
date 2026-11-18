import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { DeadlineDetail } from "@/components/app/case/DeadlineDetail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("case");
  return { title: t("metaDeadline") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeadlineDetail id={id} />;
}
