"use client";

import Link from "next/link";
import { useState } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { MOS_ATTACHMENTS_STUDY, MOS_FEES } from "@/lib/legal/mos-form";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { trData } from "./resolve";

/** Attachment id → case document kind that satisfies it. */
const DOC_FOR: Record<string, string> = {
  photo: "photo", passport: "passport", university_certificate: "university_certificate",
  health_insurance: "health_insurance", accommodation: "rental_agreement",
};

export function MosAttachments({ snap }: { snap: CaseSnapshot | null }) {
  const t = useT("mos");
  const [open, setOpen] = useState<string | null>(null);
  const has = (id: string) => {
    const kind = DOC_FOR[id];
    return !!kind && !!snap?.documents.some((d) => d.kind === kind && d.status === "have");
  };
  const fees = MOS_FEES.filter((f) => f.id === "stamp_duty_study" || f.id === "residence_card");

  return (
    <section className="stack" style={{ ["--gap" as string]: "10px" }} aria-labelledby="att-title">
      <h2 id="att-title" style={{ marginBottom: 0 }}>{t("attachments")}</h2>
      <ul className="checklist">
        {MOS_ATTACHMENTS_STUDY.map((a) => {
          const have = has(a.id);
          return (
            <li key={a.id} className={`check-item ${have ? "ci-have" : a.kind === "mandatory" ? "ci-missing" : "ci-check"}`}>
              <span className="ci-mark" aria-hidden="true">{have ? "✓" : ""}</span>
              <div>
                <div className="row between" style={{ gap: 6 }}>
                  <b>{trData(t, `a.${a.id}.title`, a.titleEn)}</b>
                  <span className="ci-status">{have ? t("inCase") : t(`kind_${a.kind}`)}</span>
                </div>
                {a.spec && <p className="small mono" style={{ margin: "4px 0 0" }}>{trData(t, `a.${a.id}.spec`, a.spec)}</p>}
                {a.id === "photo" && !have && <Link className="cite" href="/app/photo-check" style={{ marginTop: 6 }}><Icon name="camera" size={13} /> {t("makePhoto")}</Link>}
                <button type="button" className="cite" style={{ marginTop: 6, marginLeft: a.id === "photo" && !have ? 12 : 0 }} aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>{t("details")}</button>
                {open === a.id && (
                  <div className="cite-open">
                    <p lang="pl" className="tiny" style={{ margin: "0 0 4px" }}>{a.titlePl}</p>
                    <p style={{ margin: 0 }}>{trData(t, `a.${a.id}.detail`, a.detail)}</p>
                    {a.note && <p className="tiny" style={{ margin: "6px 0 0" }}>{trData(t, `a.${a.id}.note`, a.note)}</p>}
                    <a className="tiny" href={a.sourceUrl} target="_blank" rel="noreferrer">{a.verified ? t("officialSource") : t("sourceUnconfirmed")} <Icon name="external" size={11} /></a>
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
            <small>{f.verified ? trData(t, `fee.${f.id}`, f.titleEn) : t("unconfirmed", { title: trData(t, `fee.${f.id}`, f.titleEn) })}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
