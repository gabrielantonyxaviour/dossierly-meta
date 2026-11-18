"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Segmented } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import type { CaseSnapshot } from "@/lib/case/types";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import { appealDeadline } from "@/lib/residence/dates";
import { nextAppointment } from "@/lib/residence/stage";
import { useT } from "@/lib/i18n/client";
import { Block, Fact, StatusLine } from "@/components/residence/parts";
import { HelpList } from "./HelpSheet";
import { filedOn } from "./path";
import { shortDate } from "./format";
import { useResidence } from "./useResidence";

/* Stage 6 · Decision. The person records what the letter says; a refusal gets the 14-day appeal deadline from the
   KPA engine and legal aid first. Dossierly never writes the appeal. */

function RecordDecision({ c, onDone }: { c: CaseSnapshot; onDone?: () => void }) {
  const t = useT("residence");
  const { act, busy } = useResidence();
  const d = c.profile.decision;
  const [outcome, setOutcome] = useState<"approved" | "refused">(d?.outcome ?? "approved");
  const [on, setOn] = useState(d?.deliveredOn ?? "");
  const [until, setUntil] = useState(d?.validUntil ?? "");
  const [err, setErr] = useState("");
  const today = warsawToday();
  const save = async () => {
    if (!on) return setErr(t("deliveredNeeded"));
    setErr("");
    if (await act({ action: "decision", outcome, deliveredOn: on, validUntil: outcome === "approved" ? until || null : null }, t("decisionSaved"))) onDone?.();
  };
  return (
    <form className="rs-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <Segmented<"approved" | "refused"> label={t("outcome")} value={outcome} onChange={setOutcome} options={[{ value: "approved", label: t("approved") }, { value: "refused", label: t("refused") }]} />
      <div className="ob-field">
        <span className="ob-field-label" id="rs-delivered">{t("deliveredOn")}</span>
        <DatePicker value={on} onChange={setOn} min="2020-01-01" max={today} labelledBy="rs-delivered" placeholder={t("chooseDate")} />
      </div>
      {outcome === "approved" && (
        <div className="ob-field">
          <span className="ob-field-label" id="rs-valid">{t("validUntil")} <em className="rs-optional">{t("optional")}</em></span>
          <DatePicker value={until} onChange={setUntil} min={today} max="2040-12-31" labelledBy="rs-valid" placeholder={t("chooseDate")} />
        </div>
      )}
      {err && <p className="rs-err" role="alert">{err}</p>}
      <Button type="submit" variant="primary" disabled={busy} loading={busy}>{t("saveDecision")}</Button>
    </form>
  );
}

function CardCollected() {
  const t = useT("residence");
  const { act, busy } = useResidence();
  const router = useRouter();
  const [on, setOn] = useState("");
  return (
    <form className="rs-form" noValidate onSubmit={(e) => { e.preventDefault(); if (on) void act({ action: "card", collectedOn: on }, t("cardSaved")).then((ok) => ok && router.push("/app/residence/after")); }}>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-card">{t("collectedOn")}</span>
        <DatePicker value={on} onChange={setOn} min="2020-01-01" max={warsawToday()} labelledBy="rs-card" placeholder={t("chooseDate")} />
      </div>
      <Button type="submit" variant="primary" disabled={busy || !on} loading={busy}>{t("cardCollected")}</Button>
    </form>
  );
}

export function DecisionStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const [editing, setEditing] = useState(false);
  const { act, busy } = useResidence();
  const d = c.profile.decision;
  const filed = filedOn(c);
  if (!d || editing) {
    return (
      <>
        <p className="rp-lead">{t("decisionLead")}</p>
        <RecordDecision c={c} onDone={() => setEditing(false)} />
        {editing && (
          <div className="rs-row-actions">
            <Button variant="ghost" disabled={busy} onClick={() => void act({ action: "clear_decision" }, t("decisionCleared")).then((ok) => ok && setEditing(false))}>{t("clearDecision")}</Button>
            <Button variant="secondary" onClick={() => setEditing(false)}>{t("cancel")}</Button>
          </div>
        )}
        <p className="rp-note">{t("decisionNote")}</p>
      </>
    );
  }
  if (d.outcome === "refused") {
    const appeal = appealDeadline(d.deliveredOn);
    const left = daysBetween(warsawToday(), appeal.dueDate);
    return (
      <>
        <StatusLine word={t("refusedWord")} tone="deadline" sub={left >= 0 ? t("refusedSub", { date: shortDate(appeal.dueDate), n: left }) : t("refusedPassed", { date: shortDate(appeal.dueDate) })}
          pct={Math.min(100, (daysBetween(d.deliveredOn, warsawToday()) / 14) * 100)} left={t("deliveredShort", { date: shortDate(d.deliveredOn) })} right={t("appealBy", { date: shortDate(appeal.dueDate) })} />
        <div className="rp-callout tone-deadline"><b>{t("personToday")}</b><span>{t("personTodayBody")}</span></div>
        <HelpList />
        <Block title={t("howCounted")}><ol className="rp-count">{appeal.steps.map((s) => <li key={s}>{s}</li>)}</ol></Block>
        <Button variant="ghost" onClick={() => setEditing(true)}>{t("changeDecision")}</Button>
      </>
    );
  }
  const appt = nextAppointment(c);
  const cardTicked = (c.profile.checklistDone ?? []).includes("fee_card_me");
  return (
    <>
      <StatusLine word={t("approvedWord")} tone="ok" sub={d.validUntil ? t("approvedUntil", { date: shortDate(d.validUntil) }) : t("approvedSub")} pct={100}
        left={filed ? t("filedShort", { date: shortDate(filed) }) : ""} right={t("decidedShort", { date: shortDate(d.deliveredOn) })} />
      <Block title={t("collectCard")}>
        <div className="rp-stack">
          {appt ? <Fact icon="calendar" tone="ok" title={`${shortDate(warsawDate(appt.at))}`} sub={[appt.location.name, appt.location.address].filter(Boolean).join(", ")} />
            : <Fact icon="calendar" title={t("collectWhen")} sub={t("collectWhenSub")} />}
          <Fact icon={cardTicked ? "check" : "card"} tone={cardTicked ? "ok" : "warn"} title={cardTicked ? t("cardFeePaid") : t("cardFeeDue")} sub={t("cardFeeSub")} />
          <Fact icon="card" title={t("bringPassport")} sub={t("collectInPerson")} />
        </div>
      </Block>
      <Block title={t("gotCard")}><CardCollected /></Block>
      <Button variant="ghost" onClick={() => setEditing(true)}>{t("changeDecision")}</Button>
    </>
  );
}
