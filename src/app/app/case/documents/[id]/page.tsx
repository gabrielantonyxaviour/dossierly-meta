import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { DocumentDetail } from "@/components/app/case/DocumentDetail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("case");
  return { title: t("metaDocument") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetail id={id} />;
}
