"use client";

import Link from "next/link";
import { useState } from "react";
import type { CommitRequest, CommitResult, LookRead } from "@/lib/look/types";
import { Button, InlineError, Segmented, Sheet } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/Icon";
import { CitedDeadline, longDate, warsawToday } from "./CitedDeadline";
import { commitLook } from "./useLook";
import { announceCaseChange } from "../shell/case-data";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import type { T } from "@/lib/i18n/translate";

type Via = "delivered" | "notice" | "electronic";
const VIA_IDS: Via[] = ["delivered", "notice", "electronic"];
const viaOptions = (t: T) => VIA_IDS.map((value) => ({ value, label: t(`via_${value}`), help: t(`via_${value}Help`) }));
const FACTS = ["caseNumber", "office", "filedAt", "upoReceivedAt", "mosStatus", "inpolStatus"];
const factLabel = (t: T, k: string) => (FACTS.includes(k) ? t(`fact_${k}`) : k);

/** True when there is anything worth saving from this look. */
export const canSave = (read: LookRead) => read.readable && ((!!read.letter && (read.kind === "letter" || read.kind === "decision")) || Object.keys(read.facts).length > 0);

interface Props {
  read: LookRead;
  onDone(result: CommitResult): void;
  /** Phones: the form lives in a bottom sheet with the primary action in its footer. */
  sheet?: { open: boolean; onClose(): void };
}

/** Confirms what was read and writes it to the case: facts, the letter, its tasks, appointment and a cited deadline. */
export function LookConfirm({ read, onDone, sheet }: Props) {
  const t = useT("look");
  const tag = LOCALE_TAGS[useLocale()];
  const VIA = viaOptions(t);
  const isLetter = !!read.letter && (read.kind === "letter" || read.kind === "decision");
  const rule = read.letter?.deadlineRule;
  const needsDelivery = isLetter && !!rule?.amount && rule.from === "delivery";
  const [via, setVia] = useState<Via>("delivered");
  const [date, setDate] = useState(warsawToday());
  const [facts, setFacts] = useState<Record<string, string>>(() => ({ ...read.facts }) as Record<string, string>);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canSave(read)) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    const corrections = Object.fromEntries(Object.entries(facts).filter(([k, v]) => v.trim() && v !== (read.facts as Record<string, string>)[k]));
    const delivery: CommitRequest["delivery"] = needsDelivery ? (via === "notice" ? { kind: "notice", firstNoticeDate: date } : { kind: via, date }) : undefined;
    try {
      const result = await commitLook({ lookId: read.lookId, delivery, corrections: Object.keys(corrections).length ? corrections : undefined });
      announceCaseChange();
      onDone(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const appt = read.letter?.appointment;
  const form = (
    <div className="stack lk-confirm-body" style={{ ["--gap" as string]: "16px" }}>
      {Object.keys(facts).length > 0 && (
        <dl className="lk-facts">
          {Object.keys(facts).map((k) => (
            <div key={k} className="lk-fact">
              <dt>{factLabel(t, k)}{read.uncertain.includes(k) && <span className="ui-pill ui-pill--warn" style={{ marginLeft: 8 }}>{t("checkThis")}</span>}</dt>
              {editing === k ? (
                <dd><input className="ui-input" value={facts[k]} onChange={(e) => setFacts({ ...facts, [k]: e.target.value })} onBlur={() => setEditing(null)} autoFocus aria-label={factLabel(t, k)} /></dd>
              ) : (
                <dd><span className={k === "office" || k.endsWith("Status") ? undefined : "mono"}>{facts[k]}</span><Button variant="ghost" size="sm" onClick={() => setEditing(k)}>{t("edit")}</Button></dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {appt && (
        <div className="lk-appt">
          <span className="tab-label">{t("apptTitle")}</span>
          <b>{longDate(appt.date, tag)}{appt.time ? `, ${appt.time}` : ""}</b>
          {appt.place && <span>{appt.place}</span>}
          {!appt.time && <span className="small muted">{t("noTime")}</span>}
        </div>
      )}
      {isLetter && rule?.amount && rule.from === "letter_date" && read.letter?.dateOnLetter && (
        <p style={{ margin: 0 }}>{t("fromLetterDate", { date: longDate(read.letter.dateOnLetter, tag) })}</p>
      )}
      {needsDelivery && (
        <div className="lk-via">
          <p className="label" style={{ margin: "0 0 10px" }}>{t("viaQuestion")}</p>
          <Segmented value={via} onChange={setVia} options={VIA} label={t("viaLabel")} />
          <p className="small muted" style={{ margin: "10px 0" }}>{VIA.find((v) => v.value === via)?.help}</p>
          <DatePicker value={date} onChange={setDate} max={warsawToday()} ariaLabel={via === "notice" ? t("dateNotice") : t("dateReached")} />
        </div>
      )}
      {error && <InlineError message={error} />}
    </div>
  );
  const action = (
    <Button variant="primary" size="lg" block loading={busy} disabled={busy} onClick={() => void save()}>
      {busy ? t("working") : needsDelivery ? t("workOut") : t("saveCase")}
    </Button>
  );

  if (sheet) {
    return <Sheet open={sheet.open} onClose={sheet.onClose} title={t("addTitle")} footer={action}>{form}</Sheet>;
  }
  return (
    <section className="ui-card lk-confirm stack" style={{ ["--gap" as string]: "16px" }} aria-label={t("addAria")}>
      <div>
        <h3>{t("addTitle")}</h3>
        <p className="muted" style={{ margin: 0 }}>{t("addSub")}</p>
      </div>
      {form}
      {action}
    </section>
  );
}

/** What was written, plus the cited deadline when there is one. */
export function LookSaved({ result }: { result: CommitResult }) {
  const t = useT("look");
  const en = useLocale() === "en";
  const n = result.taskIds.length;
  const added = [
    result.deadline && t("addedDeadline"),
    n > 0 && (n === 1 ? t("addedTaskOne") : t("addedTasks", { n })),
    result.documentId && t("addedLetter"),
    result.appointmentId && t("addedAppt"),
    result.factsWritten.length > 0 && result.factsWritten.map((k) => (FACTS.includes(k) ? (en ? t(`fact_${k}`).toLowerCase() : t(`fact_${k}`)) : k)).join(", "),
  ].filter(Boolean) as string[];
  return (
    <div className="stack" style={{ ["--gap" as string]: "14px" }}>
      {result.deadline && <CitedDeadline deadline={result.deadline} />}
      <div className="lk-saved" role="status">
        <Icon name="check" size={18} />
        <span className="grow">{t("addedLine", { items: added.join(" · ") || t("addedNothing") })}</span>
        <Link className="ui-btn ui-btn--sm lk-desk-inline" href="/app">{t("openCase")}</Link>
      </div>
    </div>
  );
}
