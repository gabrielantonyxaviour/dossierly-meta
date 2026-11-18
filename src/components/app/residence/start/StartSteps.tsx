"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, OptionList, StickyActionBar } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { VOIVODESHIPS, type PermitType, type Profile, type Situation, type Voivodeship } from "@/lib/case/types";
import { daysToFile, fileByDate, startByDate } from "@/lib/residence/dates";
import { DEFAULT_VOIVODESHIP, GROUNDS, isGround, VOIVODESHIP_INFO, type Ground } from "@/lib/residence/model";
import { warsawToday } from "@/lib/case/next-step";
import { useT } from "@/lib/i18n/client";
import { longDate } from "../format";

/* Stage 0 · Start, the five questions (reference: ReUI Wizard-1). Shared by onboarding and /app/residence/start;
   each step renders its own Continue bar and hands its answer to the parent, which saves it. */

export const START_STEPS = ["stepSituation", "stepPermit", "stepDates", "stepFamily", "stepPlan"] as const;

export function StartStepper({ at }: { at: number }) {
  const t = useT("residence");
  return (
    <div className="rs-stepper-wrap">
      <ol className="rp-stepper" aria-label={t("stepperAria")}>
        {START_STEPS.map((s, i) => (
          <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : undefined} aria-current={i === at ? "step" : undefined}>
            <span className="rp-stepper-n ui-num">{i < at ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="rp-stepper-label">{t(s)}</span>
          </li>
        ))}
      </ol>
      <p className="rp-stepper-caption">{t("stepOf", { n: at + 1, total: START_STEPS.length, name: t(START_STEPS[at]!) })}</p>
    </div>
  );
}

export function Continue({ busy, disabled, onClick, label, secondary }: { busy: boolean; disabled?: boolean; onClick?: () => void; label?: string; secondary?: React.ReactNode }) {
  const t = useT("residence");
  return (
    <StickyActionBar secondary={secondary}>
      <Button variant="primary" size="lg" type={onClick ? "button" : "submit"} disabled={busy || disabled} loading={busy} onClick={onClick}>{label ?? t("continue")}</Button>
    </StickyActionBar>
  );
}

const SITUATIONS: { value: Situation; icon: "refresh" | "user" | "letter" | "case" }[] = [
  { value: "renew", icon: "refresh" }, { value: "family", icon: "user" }, { value: "letter", icon: "letter" }, { value: "first", icon: "case" },
];
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function SituationStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (s: Situation) => void }) {
  const t = useT("residence");
  const [pick, setPick] = useState<Situation | null>(profile.situation ?? null);
  return (
    <div className="ob-answer">
      <OptionList<Situation> label={t("sitLabel")} value={pick} onChange={setPick}
        options={SITUATIONS.map((s) => ({ value: s.value, icon: s.icon, label: t(`sit${cap(s.value)}`), sub: t(`sit${cap(s.value)}Sub`) }))} />
      <Continue busy={busy} disabled={!pick} onClick={() => pick && onNext(pick)} />
    </div>
  );
}

const GROUND_KEY: Record<Ground, string> = { temporary_residence_work: "Work", temporary_residence_blue_card: "Blue", temporary_residence_family: "Family", temporary_residence_study: "Study" };
const GROUND_ICON: Record<Ground, "case" | "card" | "user" | "book"> = { temporary_residence_work: "case", temporary_residence_blue_card: "card", temporary_residence_family: "user", temporary_residence_study: "book" };

export function GroundStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { permitType: PermitType; organisation: string | null }) => void }) {
  const t = useT("residence");
  const [pick, setPick] = useState<Ground | null>(isGround(profile.permitType) ? profile.permitType : null);
  const [org, setOrg] = useState(profile.organisation ?? "");
  const study = pick === "temporary_residence_study";
  const needsOrg = pick && pick !== "temporary_residence_family";
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (pick) onNext({ permitType: pick, organisation: needsOrg ? org.trim() || null : profile.organisation }); }}>
      <OptionList<Ground> label={t("groundLabel")} value={pick} onChange={setPick}
        options={GROUNDS.map((g) => ({ value: g, icon: GROUND_ICON[g], label: t(`ground${GROUND_KEY[g]}`), sub: t(`ground${GROUND_KEY[g]}Sub`) }))} />
      {needsOrg && (
        <label className="ob-field">
          <span>{study ? t("orgUniversity") : t("orgEmployer")} <em className="rs-optional">{t("optional")}</em></span>
          <input className="input" maxLength={160} value={org} autoComplete="organization" placeholder={study ? t("orgUniversityPh") : t("orgEmployerPh")} onChange={(e) => setOrg(e.target.value)} />
        </label>
      )}
      <Continue busy={busy} disabled={!pick} />
    </form>
  );
}

/** The file-by / start-by callout for a legal-stay end date. */
export function FileByCallout({ until }: { until: string }) {
  const t = useT("residence");
  const today = warsawToday();
  const left = daysToFile(until, today);
  const start = startByDate(until);
  if (left < 0) return <div className="rp-callout tone-deadline" role="alert"><b>{t("fileByPassedTitle")}</b><span>{t("fileByPassed")}</span></div>;
  return (
    <div className={`rp-callout ${left <= 14 ? "tone-deadline" : "tone-user"}`}>
      <b>{t("fileByTitle", { date: longDate(fileByDate(until)) })}</b>
      <span>{t("fileByBody")}</span>
      <span className="rp-callout-hint">{start > today ? t("startByHint", { date: longDate(start) }) : t("startNow", { n: left })}</span>
    </div>
  );
}

export function DatesStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { voivodeship: Voivodeship; legalStayUntil: string | null }) => void }) {
  const t = useT("residence");
  const [region, setRegion] = useState<Voivodeship>(profile.voivodeship ?? DEFAULT_VOIVODESHIP);
  const [until, setUntil] = useState(profile.legalStayUntil ?? "");
  const [touched, setTouched] = useState(false);
  const optional = profile.situation === "letter";
  const label = profile.situation === "first" ? t("stayUntilVisa") : profile.situation === "family" ? t("stayUntilFamily") : t("stayUntil");
  const missing = !optional && !until;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!missing) onNext({ voivodeship: region, legalStayUntil: until || null }); }}>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-region">{t("region")}</span>
        <Select value={region} onChange={(v) => setRegion(v as Voivodeship)} labelledBy="rs-region"
          options={VOIVODESHIPS.map((v) => ({ value: v, label: t("regionOption", { name: VOIVODESHIP_INFO[v].name, seat: VOIVODESHIP_INFO[v].seat }) }))} />
      </div>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-until">{label}{optional && <> <em>{t("optional")}</em></>}</span>
        <DatePicker value={until} onChange={setUntil} min="2020-01-01" max="2035-12-31" labelledBy="rs-until" placeholder={t("chooseDate")} />
        {touched && missing && <small className="ob-field-err" role="alert">{t("datesNeedEnd")}</small>}
      </div>
      {until ? <FileByCallout until={until} /> : <p className="rp-note">{optional ? t("stayUntilLetterHint") : t("stayUntilHint")}</p>}
      <Continue busy={busy} />
    </form>
  );
}
