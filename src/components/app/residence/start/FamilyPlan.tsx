"use client";
import { useState } from "react";
import { Button, IconButton, OptionGrid, Pill } from "@/components/ui";
import { Checkbox } from "@/components/ui/Checkbox";
import type { HouseholdMember, PermitType, Profile } from "@/lib/case/types";
import { feeLines, feeTotal, familyIncomeNeeded } from "@/lib/residence/model";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { Fact } from "@/components/residence/parts";
import { Continue, FileByCallout } from "./StartSteps";
import { zl } from "../format";

/* Start steps 4 (family) and 5 (your plan). */

export type MemberDraft = { id?: string; name: string; relation: "spouse" | "child"; birthYear: number | null; under16?: boolean; permitType: PermitType };

/** "work permit", "family permit"… in the interface language. */
export const permitShort = (t: T, p: PermitType | null | undefined) => t(`permitShort_${p ?? "other"}`);

export function memberRole(t: T, m: { relation: "spouse" | "child"; permitType: PermitType }) {
  return t(m.relation === "spouse" ? "roleSpouse" : "roleChild", { permit: permitShort(t, m.permitType) });
}

function FamilyCheck({ profile, count }: { profile: Profile; count: number }) {
  const t = useT("residence");
  const vars = { total: zl(familyIncomeNeeded(count)), n: count + 1 };
  const key = profile.permitType === "temporary_residence_work" ? "famCheckWork" : profile.permitType === "temporary_residence_blue_card" ? "famCheckBlue" : "famCheckOther";
  return <div className="rp-callout"><b>{t("famCheckTitle")}</b><span>{t(key, vars)}</span></div>;
}

type Row = { id?: string; name: string; relation: "spouse" | "child"; under16: boolean; birthYear: number | null; permitType: PermitType };

/** One editable row per family member: name, relation, under 16. Up to three. */
export function FamilyStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (m: MemberDraft[]) => void }) {
  const t = useT("residence");
  const [rows, setRows] = useState<Row[]>(() => (profile.household ?? []).map(({ id, name, relation, birthYear, under16, permitType }) => ({ id, name, relation, birthYear, under16, permitType })));
  const [tried, setTried] = useState(false);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setRows([...rows, { name: "", relation: rows.some((r) => r.relation === "spouse") ? "child" : "spouse", under16: false, birthYear: null, permitType: "temporary_residence_family" }]);
  const bad = rows.map((r) => r.name.trim().length < 2);
  const needOne = profile.situation === "family" && rows.length === 0;
  const submit = () => {
    setTried(true);
    if (needOne || bad.some(Boolean)) return;
    onNext(rows.map((r) => ({ id: r.id, name: r.name.trim(), relation: r.relation, birthYear: r.relation === "child" ? r.birthYear : null, under16: r.relation === "child" && r.under16, permitType: r.permitType })));
  };
  return (
    <div className="ob-answer">
      {rows.map((r, i) => (
        <fieldset key={r.id ?? `new-${i}`} className="rs-member-form">
          <legend className="sr-only">{t("memberN", { n: i + 1 })}</legend>
          <div className="rs-member-top">
            <label className="ob-field rs-grow"><span>{t("memberName")}</span>
              <input className="input" maxLength={120} value={r.name} autoComplete="off" placeholder={t("memberNamePh")} aria-invalid={tried && bad[i]} onChange={(e) => set(i, { name: e.target.value })} />
            </label>
            <IconButton icon="close" small label={t("memberRemove", { name: r.name || t("memberN", { n: i + 1 }) })} onClick={() => setRows(rows.filter((_, j) => j !== i))} />
          </div>
          {tried && bad[i] && <p className="ob-field-err" role="alert">{t("memberNameError")}</p>}
          <OptionGrid<"spouse" | "child"> label={t("memberRelation")} value={r.relation} onChange={(v) => set(i, { relation: v })} options={[{ value: "spouse", label: t("relSpouse") }, { value: "child", label: t("relChild") }]} />
          {r.relation === "child" && <Checkbox checked={r.under16} onChange={(v) => set(i, { under16: v })}>{t("under16")}</Checkbox>}
        </fieldset>
      ))}
      {!rows.length && <p className="rp-note">{t("familyEmpty")}</p>}
      {rows.length < 3 ? <Button variant="secondary" icon="plus" block onClick={add}>{t("addMember")}</Button> : <p className="rp-note">{t("maxMembers")}</p>}
      {rows.length > 0 && <FamilyCheck profile={profile} count={rows.length} />}
      {tried && needOne && <p className="ob-field-err" role="alert">{t("familyNeedOne")}</p>}
      <Continue busy={busy} onClick={submit} label={rows.length ? undefined : t("justMe")} />
    </div>
  );
}

/** The summary: everyone's case, their fees, the file-by date and the first thing to do. */
export function PlanSummary({ profile }: { profile: Profile }) {
  const t = useT("residence");
  const household: HouseholdMember[] = profile.household ?? [];
  const lines = feeLines({ name: profile.fullName ?? t("you"), permitType: profile.permitType }, household);
  const letter = profile.situation === "letter";
  const stagePill = <Pill tone="warn">{letter ? t("stage_waiting") : t("stage_prepare")}</Pill>;
  return (
    <div className="rp-stack rs-plan">
      <p className="rp-lead">{household.length ? t("planSubMany", { n: household.length + 1 }) : t("planSubOne")}</p>
      <div className="rp-stack">
        {lines.map((l, i) => {
          const m = household[i - 1];
          const role = m ? memberRole(t, m) : t("roleYou", { permit: permitShort(t, profile.permitType) });
          return <Fact key={l.memberId} icon="case" title={l.who || t("you")} sub={`${role} · ${t("feePair", { stamp: l.stamp, card: l.card })}`} end={stagePill} />;
        })}
      </div>
      <p className="rp-note">{t("planFeesTotal", { total: zl(feeTotal(lines)), n: lines.length * 2 })}</p>
      {profile.legalStayUntil && !letter && <FileByCallout until={profile.legalStayUntil} />}
      <div className="rp-callout tone-user">
        <b>{letter ? t("planNextLetter") : t("planNextEdelivery")}</b>
        <span>{letter ? t("planNextLetterBody") : t("planNextEdeliveryBody")}</span>
      </div>
    </div>
  );
}
