"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Button, OptionList, StickyActionBar } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Combobox } from "@/components/ui/Combobox";
import { VOIVODESHIPS, type PermitType, type Profile, type Situation, type Voivodeship } from "@/lib/case/types";
import { daysToFile, fileByDate, startByDate } from "@/lib/residence/dates";
import { CITIES, DEFAULT_VOIVODESHIP, GROUNDS, isGround, VOIVODESHIP_INFO, voivodeshipOfCity, type Ground } from "@/lib/residence/model";
import { warsawToday } from "@/lib/case/next-step";
import { useT } from "@/lib/i18n/client";
import { longDate } from "../format";

/* The setup questions (reference: ReUI Wizard-1: numbered stepper, thin progress, one question group per step,
   Back and Next, inline validation). Shared by onboarding and /app/residence/start; each step renders the Back/Next
   bar and hands its answer to the parent, which saves it before moving on. */

/** Back handler for the bar, provided by the wizard around the steps. */
export const StartNav = createContext<{ back?: () => void }>({});

export function StartStepper({ at, labels }: { at: number; labels: string[] }) {
  const t = useT("residence");
  return (
    <div className="rs-stepper-wrap">
      <ol className="rp-stepper rs-stepper-dense" aria-label={t("stepperAria")}>
        {labels.map((s, i) => (
          <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : undefined} aria-current={i === at ? "step" : undefined}>
            <span className="rp-stepper-n ui-num">{i < at ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>
      <p className="rp-stepper-caption">{t("stepOf", { n: at + 1, total: labels.length, name: labels[at] ?? "" })}</p>
    </div>
  );
}

export function Continue({ busy, disabled, onClick, label, secondary }: { busy: boolean; disabled?: boolean; onClick?: () => void; label?: string; secondary?: ReactNode }) {
  const t = useT("residence");
  const { back } = useContext(StartNav);
  const second = secondary ?? (back ? <Button variant="ghost" icon="back" disabled={busy} onClick={back}>{t("back")}</Button> : undefined);
  return (
    <StickyActionBar secondary={second}>
      <Button variant="primary" size="lg" iconEnd="forward" type={onClick ? "button" : "submit"} disabled={busy || disabled} loading={busy} onClick={onClick}>{label ?? t("next")}</Button>
    </StickyActionBar>
  );
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const SITUATIONS: { value: Situation; icon: "refresh" | "user" | "letter" | "case" }[] = [
  { value: "renew", icon: "refresh" }, { value: "family", icon: "user" }, { value: "letter", icon: "letter" }, { value: "first", icon: "case" },
];

/** Field error shown under a choice when Next is pressed without one. */
const Err = ({ show, text }: { show: boolean; text: string }) => (show ? <p className="ob-field-err" role="alert">{text}</p> : null);

export function SituationStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (s: Situation) => void }) {
  const t = useT("residence");
  const [pick, setPick] = useState<Situation | null>(profile.situation ?? null);
  const [tried, setTried] = useState(false);
  return (
    <div className="ob-answer">
      <OptionList<Situation> label={t("sitLabel")} value={pick} onChange={setPick}
        options={SITUATIONS.map((s) => ({ value: s.value, icon: s.icon, label: t(`sit${cap(s.value)}`), sub: t(`sit${cap(s.value)}Sub`) }))} />
      <Err show={tried && !pick} text={t("pickOne")} />
      <Continue busy={busy} onClick={() => (pick ? onNext(pick) : setTried(true))} />
    </div>
  );
}

const GROUND_KEY: Record<Ground, string> = { temporary_residence_work: "Work", temporary_residence_blue_card: "Blue", temporary_residence_family: "Family", temporary_residence_study: "Study" };
const GROUND_ICON: Record<Ground, "case" | "card" | "user" | "book"> = { temporary_residence_work: "case", temporary_residence_blue_card: "card", temporary_residence_family: "user", temporary_residence_study: "book" };
const ORDER: Ground[] = ["temporary_residence_work", "temporary_residence_family", "temporary_residence_study", "temporary_residence_blue_card"];

export function GroundStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { permitType: PermitType; organisation: string | null }) => void }) {
  const t = useT("residence");
  const [pick, setPick] = useState<Ground | null>(isGround(profile.permitType) ? profile.permitType : null);
  const [org, setOrg] = useState(profile.organisation ?? "");
  const [tried, setTried] = useState(false);
  const study = pick === "temporary_residence_study";
  const needsOrg = !!pick && pick !== "temporary_residence_family";
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (!pick) return setTried(true); onNext({ permitType: pick, organisation: needsOrg ? org.trim() || null : profile.organisation }); }}>
      <OptionList<Ground> label={t("groundLabel")} value={pick} onChange={setPick}
        options={ORDER.filter((g) => GROUNDS.includes(g)).map((g) => ({ value: g, icon: GROUND_ICON[g], label: t(`ground${GROUND_KEY[g]}`), sub: t(`ground${GROUND_KEY[g]}Sub`) }))} />
      <Err show={tried && !pick} text={t("pickOne")} />
      {needsOrg && (
        <label className="ob-field">
          <span>{study ? t("orgUniversity") : t("orgEmployer")} <em className="rs-optional">{t("optional")}</em></span>
          <input className="input" maxLength={160} value={org} autoComplete="organization" placeholder={study ? t("orgUniversityPh") : t("orgEmployerPh")} onChange={(e) => setOrg(e.target.value)} />
        </label>
      )}
      <Continue busy={busy} />
    </form>
  );
}

export function RegionStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { voivodeship: Voivodeship; city: string }) => void }) {
  const t = useT("residence");
  const [region, setRegion] = useState<Voivodeship>(profile.voivodeship ?? voivodeshipOfCity(profile.city) ?? DEFAULT_VOIVODESHIP);
  const [city, setCity] = useState(profile.city === "Warsaw" ? "Warszawa" : profile.city ?? CITIES[region][0]!);
  const [tried, setTried] = useState(false);
  const pickRegion = (v: Voivodeship) => { setRegion(v); setCity(CITIES[v][0]!); };
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (city.trim().length < 2) return setTried(true); onNext({ voivodeship: region, city: city.trim() }); }}>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-region">{t("region")}</span>
        <Combobox value={region} onChange={(v) => pickRegion(v as Voivodeship)} labelledBy="rs-region"
          options={VOIVODESHIPS.map((v) => ({ value: v, label: VOIVODESHIP_INFO[v].name }))} />
      </div>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-city">{t("city")}</span>
        <Combobox value={city} onChange={setCity} labelledBy="rs-city" allowCustom placeholder={t("cityNamePh")}
          customLabel={(x) => x} options={CITIES[region].map((c) => ({ value: c, label: c }))} />
        <small className="rs-hint">{t("cityHint")}</small>
        <Err show={tried && city.trim().length < 2} text={t("cityNeeded")} />
      </div>
      <p className="rp-note">{t("regionNote", { office: VOIVODESHIP_INFO[region].office })}</p>
      <Continue busy={busy} />
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
    <div className={`rp-callout ${left <= 14 ? "tone-deadline" : "tone-user"}`} aria-live="polite">
      <b>{t("fileByTitle", { date: longDate(fileByDate(until)) })}</b>
      <span>{t("fileByBody")}</span>
      <span className="rp-callout-hint">{start > today ? t("startByHint", { date: longDate(start) }) : t("startNow", { n: left })}</span>
    </div>
  );
}

export function ExpiryStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { legalStayUntil: string | null }) => void }) {
  const t = useT("residence");
  const [until, setUntil] = useState(profile.legalStayUntil ?? "");
  const [tried, setTried] = useState(false);
  const optional = profile.situation === "letter";
  const label = profile.situation === "first" ? t("stayUntilVisa") : profile.situation === "family" ? t("stayUntilFamily") : t("stayUntil");
  const missing = !optional && !until;
  return (
    <form className="ob-answer" noValidate onSubmit={(e) => { e.preventDefault(); if (missing) return setTried(true); onNext({ legalStayUntil: until || null }); }}>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-until">{label}{optional && <> <em>{t("optional")}</em></>}</span>
        <DatePicker value={until} onChange={setUntil} min="2020-01-01" max="2035-12-31" labelledBy="rs-until" placeholder={t("chooseDate")}
          yearPicks={Array.from({ length: 4 }, (_, i) => Number(warsawToday().slice(0, 4)) + i)} />
        <Err show={tried && missing} text={t("datesNeedEnd")} />
      </div>
      {until ? <FileByCallout until={until} /> : <p className="rp-note">{optional ? t("stayUntilLetterHint") : t("stayUntilHint")}</p>}
      <Continue busy={busy} />
    </form>
  );
}

type Pays = "yes" | "no" | "unsure";

export function EmployerStep({ profile, busy, onNext }: { profile: Profile; busy: boolean; onNext: (p: { employerPays: Pays }) => void }) {
  const t = useT("residence");
  const [pick, setPick] = useState<Pays | null>(profile.employerPays ?? null);
  const [tried, setTried] = useState(false);
  return (
    <div className="ob-answer">
      <OptionList<Pays> label={t("employerLabel")} value={pick} onChange={setPick} options={[
        { value: "yes", icon: "check", label: t("paysYes"), sub: t("paysYesSub") },
        { value: "no", icon: "card", label: t("paysNo"), sub: t("paysNoSub") },
        { value: "unsure", icon: "help", label: t("paysUnsure"), sub: t("paysUnsureSub") },
      ]} />
      <Err show={tried && !pick} text={t("pickOne")} />
      <Continue busy={busy} onClick={() => (pick ? onNext({ employerPays: pick }) : setTried(true))} />
    </div>
  );
}
