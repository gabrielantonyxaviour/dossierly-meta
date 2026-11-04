"use client";
import Link from "next/link";
import type { CaseSnapshot } from "@/lib/case/types";
import { Icon } from "@/components/Icon";
import { ago } from "../format";
import { proposals, reviewCounts } from "./derive";
import "./review.css";

/** Entry to /app/case/review. On Home only when a review exists; on Case always (it can start the first one). */
export function ReviewEntry({ c, always }: { c: CaseSnapshot; always?: boolean }) {
  const r = reviewCounts(c);
  if (!r && !always) return null;
  const p = proposals(c).length;
  const sub = r
    ? [`${r.risks} risk${r.risks === 1 ? "" : "s"}${r.high ? ` (${r.high} high)` : ""}`, r.inconsistencies ? `${r.inconsistencies} to fix` : null, p ? `${p} proposed` : null, r.reviewedAt ? ago(r.reviewedAt).toLowerCase() : null].filter(Boolean).join(" · ")
    : "Muse Wonder checks your whole case for what could go wrong";
  return (
    <Link href="/app/case/review" className="rv-entry">
      <span className="rv-entry-icon" aria-hidden="true"><Icon name="sparkle" size={20} /></span>
      <span className="rv-entry-main"><b>Case review</b><span>{sub}</span></span>
      <Icon name="forward" size={18} />
    </Link>
  );
}
