"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseSnapshot } from "@/lib/case/types";
import { MOS_FORM_SOURCE, MOS_SECTIONS, type MosField } from "@/lib/legal/mos-form";
import { CopyValue } from "../look/CopyValue";
import { Icon } from "@/components/Icon";
import { MobileFlowHeader, MobilePage, ScreenTitle, StickyActionBar } from "@/components/ui";
import { EmployerCheck } from "./EmployerCheck";
import { MosAttachments } from "./MosAttachments";
import { resolveCaseKey, trData } from "./resolve";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { rich } from "@/lib/i18n/rich";
import "../look/look.css";
import "./mos.css";

function FieldRow({ n, field, value }: { n: number; field: MosField; value: string | null }) {
  const t = useT("mos");
  return (
    <li className={`mos-field${value ? " has-value" : ""}`}>
      <span className="mos-n mono" aria-hidden="true">{n}</span>
      <div className="mos-labels">
        <b lang="pl">{field.labelPl}{field.required && <span className="mos-req" title={t("required")}> *</span>}</b>
        <small>{trData(t, `l.${field.id}`, field.labelEn)}</small>
        {value ? <span className="mos-val mono">{value}</span> : <span className="mos-hint">{trData(t, `h.${field.id}`, field.hint)} <span className="muted">{rich(t("example"), { value: <span lang="pl">{field.example}</span> })}</span></span>}
      </div>
      {value && <CopyValue text={value} />}
    </li>
  );
}

export function MosSheet() {
  const t = useT("mos");
  const tag = LOCALE_TAGS[useLocale()];
  const longDate = (iso: string) => new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
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
    <>
    <MobileFlowHeader back="/app/look" backLabel={t("back")} title={t("headerTitle")} />
    <MobilePage actions className="lk-page mos-page">
      <ScreenTitle title={t("title")} sub={t("sub")} />

      <section className="ui-card mos-progress" aria-live="polite">
        {!snap && !failed && <div className="skeleton" style={{ height: 40 }} />}
        {failed && <p className="small" style={{ margin: 0 }}>{t("loadFailed")}</p>}
        {snap && (
          <>
            <div className="row between"><b>{t("ready", { ready, total })}</b><span className="ui-pill">{t("studiesPermit")}</span></div>
            <div className="vp-meter"><span style={{ width: `${(ready / total) * 100}%` }} /></div>
            <p className="tiny muted" style={{ margin: "8px 0 0" }}>{trData(t, "fillingRule", MOS_FORM_SOURCE.fillingRule)}</p>
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
                <span className="grow"><b>{trData(t, `s.${s.id}`, s.titleEn)}</b><small lang="pl">{s.titlePl}</small></span>
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
      <p className="tiny muted">{rich(t("sourceNote", { regulation: MOS_FORM_SOURCE.regulation, inForce: longDate(MOS_FORM_SOURCE.inForceFrom), checked: longDate(MOS_FORM_SOURCE.verifiedOn) }), { link: <a href={MOS_FORM_SOURCE.url} target="_blank" rel="noreferrer">Sejm ELI</a> })}</p>
    </MobilePage>
      <StickyActionBar>
        <a className="ui-btn ui-btn--primary" href="https://mos.cudzoziemcy.gov.pl/" target="_blank" rel="noreferrer"><Icon name="external" size={19} /> {t("openMos")}</a>
      </StickyActionBar>
    </>
  );
}
