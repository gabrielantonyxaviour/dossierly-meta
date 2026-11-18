"use client";
import Link from "next/link";
import type { CaseSnapshot } from "@/lib/case/types";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { ago } from "../format";
import { proposals, reviewCounts } from "./derive";
import "./review.css";

/** Entry to /app/case/review. On Home only when a review exists; on Case always (it can start the first one). */
export function ReviewEntry({ c, always }: { c: CaseSnapshot; always?: boolean }) {
  const t = useT("review");
  const r = reviewCounts(c);
  if (!r && !always) return null;
  const p = proposals(c).length;
  const sub = r
    ? [r.high ? (r.risks === 1 ? t("riskOneHigh") : t("risksHigh", { n: r.risks, high: r.high })) : r.risks === 1 ? t("riskOne") : t("risksMany", { n: r.risks }), r.inconsistencies ? t("toFix", { n: r.inconsistencies }) : null, p ? t("proposedCount", { n: p }) : null, r.reviewedAt ? ago(r.reviewedAt).toLowerCase() : null].filter(Boolean).join(" · ")
    : t("entryEmpty");
  return (
    <Link href="/app/case/review" className="rv-entry">
      <span className="rv-entry-icon" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
      <span className="rv-entry-main"><b>{t("title")}</b><span>{sub}</span></span>
      <Icon name="forward" size={18} />
    </Link>
  );
}
