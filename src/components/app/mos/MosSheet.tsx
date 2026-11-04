"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { MOS_FORM_SOURCE, MOS_SECTIONS, type MosField } from "@/lib/legal/mos-form";
import { CopyValue } from "../look/CopyValue";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/ui";
import { EmployerCheck } from "./EmployerCheck";
import { MosAttachments } from "./MosAttachments";
import { resolveCaseKey } from "./resolve";
import "../look/look.css";
import "./mos.css";

function FieldRow({ n, field, value }: { n: number; field: MosField; value: string | null }) {
  return (
    <li className={`mos-field${value ? " has-value" : ""}`}>
      <span className="mos-n mono" aria-hidden="true">{n}</span>
      <div className="mos-labels">
        <b lang="pl">{field.labelPl}{field.required && <span className="mos-req" title="Required"> *</span>}</b>
        <small>{field.labelEn}</small>
        {value ? <span className="mos-val mono">{value}</span> : <span className="mos-hint">{field.hint} <span className="muted">e.g. {field.example}</span></span>}
      </div>
      {value && <CopyValue text={value} />}
    </li>
  );
}

export function MosSheet() {
  const [snap, setSnap] = useState<CaseSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string>(MOS_SECTIONS[0]?.id ?? "");

  useEffect(() => {
    fetch("/api/case").then((r) => (r.ok ? r.json() : Promise.reject())).then(setSnap).catch(() => setFailed(true));
  }, []);

  const values = useMemo(() => new Map(MOS_SECTIONS.flatMap((s) => s.fields.map((f) => [f.id, resolveCaseKey(snap, f.caseKey)] as const))), [snap]);
  const total = MOS_SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  const ready = [...values.values()].filter(Boolean).length;
  const starts = MOS_SECTIONS.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + MOS_SECTIONS[i - 1].fields.length], []);

  return (
    <div className="sh-page lk-page mos-page">
      <TopBar title="MOS sheet" back={{ href: "/app/look", label: "Look" }} sub="Every field of the temporary residence application, in the order MOS asks for it. What your case already knows is filled in: tap to copy, then paste it into MOS yourself." />

      <section className="ui-card mos-progress" aria-live="polite">
        {!snap && !failed && <div className="skeleton" style={{ height: 40 }} />}
        {failed && <p className="small" style={{ margin: 0 }}>Your case could not be loaded, so nothing is prefilled. The field list below is still complete.</p>}
        {snap && (
          <>
            <div className="row between"><b>{ready} of {total} fields ready from your case</b><span className="ui-pill">Studies permit</span></div>
            <div className="vp-meter"><span style={{ width: `${(ready / total) * 100}%` }} /></div>
            <p className="tiny muted" style={{ margin: "8px 0 0" }}>{MOS_FORM_SOURCE.fillingRule}</p>
          </>
        )}
      </section>
      <div className="mos-sections">
        {MOS_SECTIONS.map((s) => {
          const start = starts[MOS_SECTIONS.indexOf(s)];
          const done = s.fields.filter((f) => values.get(f.id)).length;
          const isOpen = open === s.id;
          return (
            <section key={s.id} className={`mos-section${isOpen ? " is-open" : ""}`}>
              <button type="button" className="mos-section-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? "" : s.id)}>
                <span className="grow"><b>{s.titleEn}</b><small lang="pl">{s.titlePl}</small></span>
                <span className="mos-count mono">{done}/{s.fields.length}</span>
                <Icon name="chevron" size={18} />
              </button>
              {isOpen && <ol className="mos-fields">{s.fields.map((f, i) => <FieldRow key={f.id} n={start + i + 1} field={f} value={values.get(f.id) ?? null} />)}</ol>}
            </section>
          );
        })}
      </div>
      <MosAttachments snap={snap} />
      <EmployerCheck />
      <p className="tiny muted">Field list from the official form, {MOS_FORM_SOURCE.regulation} (<a href={MOS_FORM_SOURCE.url} target="_blank" rel="noreferrer">Sejm ELI</a>), in force from 27 April 2026, checked {MOS_FORM_SOURCE.verifiedOn}. The MOS screens may word some labels slightly differently. Dossierly never logs in to MOS or files for you.</p>
      <div className="lk-dock">
        <a className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" href="https://mos.cudzoziemcy.gov.pl/" target="_blank" rel="noreferrer"><Icon name="external" size={19} /> Open MOS in a new tab</a>
      </div>
    </div>
  );
}
