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

type Via = "delivered" | "notice" | "electronic";
const VIA: { value: Via; label: string; help: string }[] = [
  { value: "delivered", label: "In hand", help: "The date the postman or office gave it to you, or you signed for it." },
  { value: "notice", label: "Awizo slip", help: "The date on the first notice slip. Uncollected letters count as delivered 14 days later." },
  { value: "electronic", label: "e-Doręczenia", help: "The date the message arrived in your e-Doręczenia inbox." },
];
const FACT_LABEL: Record<string, string> = { caseNumber: "Case number", office: "Office", filedAt: "Filed on", upoReceivedAt: "Receipt (UPO) date", mosStatus: "MOS status", inpolStatus: "inPOL status" };

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
      setError(e instanceof Error ? e.message : "Could not save to your case.");
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
              <dt>{FACT_LABEL[k] ?? k}{read.uncertain.includes(k) && <span className="ui-pill ui-pill--warn" style={{ marginLeft: 8 }}>Check this</span>}</dt>
              {editing === k ? (
                <dd><input className="ui-input" value={facts[k]} onChange={(e) => setFacts({ ...facts, [k]: e.target.value })} onBlur={() => setEditing(null)} autoFocus aria-label={FACT_LABEL[k] ?? k} /></dd>
              ) : (
                <dd><span className={k === "office" || k.endsWith("Status") ? undefined : "mono"}>{facts[k]}</span><Button variant="ghost" size="sm" onClick={() => setEditing(k)}>Edit</Button></dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {appt && (
        <div className="lk-appt">
          <span className="tab-label">Appointment in this letter</span>
          <b>{longDate(appt.date)}{appt.time ? `, ${appt.time}` : ""}</b>
          {appt.place && <span>{appt.place}</span>}
          {!appt.time && <span className="small muted">No time printed; check the letter.</span>}
        </div>
      )}
      {isLetter && rule?.amount && rule.from === "letter_date" && read.letter?.dateOnLetter && (
        <p style={{ margin: 0 }}>The deadline counts from the date on the letter, {longDate(read.letter.dateOnLetter)}.</p>
      )}
      {needsDelivery && (
        <div className="lk-via">
          <p className="label" style={{ margin: "0 0 10px" }}>How did this letter reach you?</p>
          <Segmented value={via} onChange={setVia} options={VIA} label="How the letter reached you" />
          <p className="small muted" style={{ margin: "10px 0" }}>{VIA.find((v) => v.value === via)?.help}</p>
          <DatePicker value={date} onChange={setDate} max={warsawToday()} ariaLabel={via === "notice" ? "Date on the first notice slip" : "Date it reached you"} />
        </div>
      )}
      {error && <InlineError message={error} />}
    </div>
  );
  const action = (
    <Button variant="primary" size="lg" block loading={busy} disabled={busy} onClick={() => void save()}>
      {busy ? "Working out your deadline…" : needsDelivery ? "Work out my deadline" : "Save to my case"}
    </Button>
  );

  if (sheet) {
    return <Sheet open={sheet.open} onClose={sheet.onClose} title="Add this to your case" footer={action}>{form}</Sheet>;
  }
  return (
    <section className="ui-card lk-confirm stack" style={{ ["--gap" as string]: "16px" }} aria-label="Add to your case">
      <div>
        <h3>Add this to your case</h3>
        <p className="muted" style={{ margin: 0 }}>Check what I read. Nothing is saved until you confirm.</p>
      </div>
      {form}
      {action}
    </section>
  );
}

/** What was written, plus the cited deadline when there is one. */
export function LookSaved({ result }: { result: CommitResult }) {
  const added = [
    result.deadline && "a deadline with its working",
    result.taskIds.length > 0 && `${result.taskIds.length} task${result.taskIds.length === 1 ? "" : "s"}`,
    result.documentId && "this letter",
    result.appointmentId && "the appointment",
    result.factsWritten.length > 0 && result.factsWritten.map((k) => FACT_LABEL[k]?.toLowerCase() ?? k).join(", "),
  ].filter(Boolean) as string[];
  return (
    <div className="stack" style={{ ["--gap" as string]: "14px" }}>
      {result.deadline && <CitedDeadline deadline={result.deadline} />}
      <div className="lk-saved" role="status">
        <Icon name="check" size={18} />
        <span className="grow">Added to your case: {added.join(" · ") || "nothing new"}.</span>
        <Link className="ui-btn ui-btn--sm lk-desk-inline" href="/app">Open case</Link>
      </div>
    </div>
  );
}
