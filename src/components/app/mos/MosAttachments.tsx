"use client";

import Link from "next/link";
import { useState } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { MOS_ATTACHMENTS_STUDY, MOS_FEES } from "@/lib/legal/mos-form";
import { Icon } from "@/components/Icon";

/** Attachment id → case document kind that satisfies it. */
const DOC_FOR: Record<string, string> = {
  photo: "photo", passport: "passport", university_certificate: "university_certificate",
  health_insurance: "health_insurance", accommodation: "rental_agreement",
};
const KIND_LABEL = { mandatory: "Required to file", payment: "Fee", supporting: "Supporting" } as const;

export function MosAttachments({ snap }: { snap: CaseSnapshot | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const has = (id: string) => {
    const kind = DOC_FOR[id];
    return !!kind && !!snap?.documents.some((d) => d.kind === kind && d.status === "have");
  };
  const fees = MOS_FEES.filter((f) => f.id === "stamp_duty_study" || f.id === "residence_card");

  return (
    <section className="stack" style={{ ["--gap" as string]: "10px" }} aria-labelledby="att-title">
      <h2 id="att-title" style={{ marginBottom: 0 }}>Attachments</h2>
      <ul className="checklist">
        {MOS_ATTACHMENTS_STUDY.map((a) => {
          const have = has(a.id);
          return (
            <li key={a.id} className={`check-item ${have ? "ci-have" : a.kind === "mandatory" ? "ci-missing" : "ci-check"}`}>
              <span className="ci-mark" aria-hidden="true">{have ? "✓" : ""}</span>
              <div>
                <div className="row between" style={{ gap: 6 }}>
                  <b>{a.titleEn}</b>
                  <span className="ci-status">{have ? "In your case" : KIND_LABEL[a.kind]}</span>
                </div>
                {a.spec && <p className="small mono" style={{ margin: "4px 0 0" }}>{a.spec}</p>}
                {a.id === "photo" && !have && <Link className="cite" href="/app/photo-check" style={{ marginTop: 6 }}><Icon name="camera" size={13} /> Make a compliant photo</Link>}
                <button type="button" className="cite" style={{ marginTop: 6, marginLeft: a.id === "photo" && !have ? 12 : 0 }} aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>Details</button>
                {open === a.id && (
                  <div className="cite-open">
                    <p lang="pl" className="tiny" style={{ margin: "0 0 4px" }}>{a.titlePl}</p>
                    <p style={{ margin: 0 }}>{a.detail}</p>
                    {a.note && <p className="tiny" style={{ margin: "6px 0 0" }}>{a.note}</p>}
                    <a className="tiny" href={a.sourceUrl} target="_blank" rel="noreferrer">{a.verified ? "Official source" : "Source (not confirmed in an official text)"} <Icon name="external" size={11} /></a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mos-fees">
        {fees.map((f) => (
          <a key={f.id} className="mos-fee" href={f.sourceUrl} target="_blank" rel="noreferrer">
            <span className="mono">{f.amountPln} zł</span>
            <small>{f.titleEn}{f.verified ? "" : " (unconfirmed)"}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
