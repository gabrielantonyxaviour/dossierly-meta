"use client";
import { useState } from "react";
import { Button, IconButton, OptionGrid, Pill } from "@/components/ui";
import { Select } from "@/components/ui/Select";
import type { HouseholdMember, PermitType, Profile } from "@/lib/case/types";
import { feeLines, feeTotal, familyIncomeNeeded } from "@/lib/residence/model";
import { warsawToday } from "@/lib/case/next-step";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { Fact } from "@/components/residence/parts";
import { Continue, FileByCallout } from "./StartSteps";
import { zl } from "../format";

/* Start steps 4 (family) and 5 (your plan). */

export type MemberDraft = { id?: string; name: string; relation: "spouse" | "child"; birthYear: number | null; permitType: PermitType };

const MEMBER_PERMITS: PermitType[] = ["temporary_residence_family", "temporary_residence_study", "temporary_residence_work"];

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

export function FamilyStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (m: MemberDraft[]) => void }) {
  const t = useT("residence");
  const [members, setMembers] = useState<MemberDraft[]>(() => (profile.household ?? []).map(({ id, name, relation, birthYear, permitType }) => ({ id, name, relation, birthYear, permitType })));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<"spouse" | "child">("spouse");
  const [year, setYear] = useState("");
  const [permit, setPermit] = useState<PermitType>("temporary_residence_family");
  const [error, setError] = useState("");
  const thisYear = Number(warsawToday().slice(0, 4));
  const needOne = profile.situation === "family" && members.length === 0;

  function add() {
    const y = year ? Number(year) : null;
    if (name.trim().length < 2) return setError(t("memberNameError"));
    if (relation === "child" && (!y || y < thisYear - 30 || y > thisYear)) return setError(t("birthYearError"));
    setMembers([...members, { name: name.trim(), relation, birthYear: relation === "child" ? y : null, permitType: permit }]);
    setName(""); setYear(""); setRelation("child"); setPermit("temporary_residence_family"); setError(""); setAdding(false);
  }

  return (
    <div className="ob-answer">
      <div className="rp-stack">
        {members.map((m, i) => (
          <Fact key={`${m.name}-${i}`} icon="user" tone="ok" title={m.name}
            sub={m.relation === "child" && m.birthYear ? `${memberRole(t, m)} · ${t("bornIn", { year: m.birthYear })}` : memberRole(t, m)}
            end={<IconButton icon="close" small label={t("memberRemove", { name: m.name })} onClick={() => setMembers(members.filter((_, j) => j !== i))} />} />
        ))}
        {!members.length && !adding && <p className="rp-note">{t("familyEmpty")}</p>}
      </div>
      {adding ? (
        <div className="rs-member-form">
          <label className="ob-field"><span>{t("memberName")}</span>
            <input className="input" autoFocus maxLength={120} value={name} autoComplete="off" placeholder={t("memberNamePh")} onChange={(e) => setName(e.target.value)} />
          </label>
          <OptionGrid<"spouse" | "child"> label={t("memberRelation")} value={relation} onChange={setRelation} options={[{ value: "spouse", label: t("relSpouse") }, { value: "child", label: t("relChild") }]} />
          {relation === "child" && (
            <label className="ob-field"><span>{t("birthYear")}</span>
              <input className="input ui-num" inputMode="numeric" maxLength={4} value={year} placeholder={String(thisYear - 6)} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} />
            </label>
          )}
          <div className="ob-field"><span className="ob-field-label" id="rs-mperm">{t("memberPermit")}</span>
            <Select value={permit} onChange={(v) => setPermit(v as PermitType)} labelledBy="rs-mperm" options={MEMBER_PERMITS.map((p) => ({ value: p, label: permitShort(t, p) }))} />
          </div>
          {error && <p className="ob-field-err" role="alert">{error}</p>}
          <div className="rs-row-actions">
            <Button variant="ghost" onClick={() => { setAdding(false); setError(""); }}>{t("cancel")}</Button>
            <Button variant="secondary" icon="plus" onClick={add}>{t("memberSave")}</Button>
          </div>
        </div>
      ) : members.length < 3 ? (
        <Button variant="secondary" icon="plus" block onClick={() => setAdding(true)}>{t("addMember")}</Button>
      ) : <p className="rp-note">{t("maxMembers")}</p>}
      {members.length > 0 && <FamilyCheck profile={profile} count={members.length} />}
      {needOne && !adding && <p className="rp-note">{t("familyNeedOne")}</p>}
      <Continue busy={busy} disabled={needOne || adding} onClick={() => onNext(members)} label={members.length ? t("continue") : t("justMe")} />
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
