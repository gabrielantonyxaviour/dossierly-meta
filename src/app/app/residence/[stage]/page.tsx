import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { RESIDENCE_STAGES, type ResidenceStage } from "@/lib/case/types";
import { ResidenceStageScreen } from "@/components/app/residence/StageScreen";

export async function generateMetadata({ params }: { params: Promise<{ stage: string }> }): Promise<Metadata> {
  const { stage } = await params;
  const t = await getT("residence");
  return { title: (RESIDENCE_STAGES as readonly string[]).includes(stage) ? t(`stage_${stage}`) : t("metaTitle") };
}

/** /app/residence/<stage>: one screen per stage of the residence case (start .. after). */
export default async function Page({ params }: { params: Promise<{ stage: string }> }) {
  const { stage } = await params;
  if (!(RESIDENCE_STAGES as readonly string[]).includes(stage)) notFound();
  return <ResidenceStageScreen stage={stage as ResidenceStage} />;
}
