"use client";
import type { ReactNode } from "react";
import { ErrorState, Skeleton, TopBar } from "@/components/ui";
import type { CaseSnapshot, ResidenceStage } from "@/lib/case/types";
import { useT } from "@/lib/i18n/client";
import { useCaseData } from "../shell/case-data";
import "@/components/residence/residence.css";
import "./residence-app.css";

const N: Record<ResidenceStage, number> = { start: 0, prepare: 1, file: 2, waiting: 3, letter: 4, visit: 5, decision: 6, after: 7 };

/** Loading, error and the stage header around a stage screen. `children` gets the loaded case. */
export function StageFrame({ stage, title, children }: { stage: ResidenceStage; title: (c: CaseSnapshot) => string; children: (c: CaseSnapshot) => ReactNode }) {
  const t = useT("residence");
  const { status, snapshot, error, refresh } = useCaseData();
  if (status === "loading" && !snapshot) {
    return (
      <div className="sh-page rs-page" aria-busy="true" aria-label={t("loading")}>
        <div style={{ height: 56 }} />
        <Skeleton h={20} w="40%" />
        <Skeleton h={36} w="80%" />
        <Skeleton h={150} r={22} />
        <Skeleton h={220} r={22} />
      </div>
    );
  }
  if (!snapshot) return <div className="sh-page rs-page"><ErrorState message={error ?? t("loadFailed")} onRetry={() => void refresh()} /></div>;
  return (
    <div className="sh-page rs-page">
      <TopBar back={{ href: "/app", label: t("backHome") }} eyebrow={t("stageOf", { n: N[stage], name: t(`stage_${stage}`) })} title={title(snapshot)} />
      <div className="rp-screen rs-screen">{children(snapshot)}</div>
      <p className="rp-note rs-disclaimer">{t("notAdvice")}</p>
    </div>
  );
}
