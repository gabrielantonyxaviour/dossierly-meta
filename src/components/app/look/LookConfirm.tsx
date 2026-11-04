"use client";

import Link from "next/link";
import { useState } from "react";
import type { CommitRequest, CommitResult, LookRead } from "@/lib/look/types";
import { DatePicker } from "@/components/ui/DatePicker";
import { Icon } from "@/components/Icon";
import { CitedDeadline, longDate, warsawToday } from "./CitedDeadline";
import { commitLook } from "./useLook";

type Via = "delivered" | "notice" | "electronic";
const VIA: { id: Via; label: string; help: string }[] = [
  { id: "delivered", label: "Handed to me", help: "The date the postman or office gave it to you, or you signed for it." },
  { id: "notice", label: "Notice slip (awizo)", help: "The date on the first slip. Uncollected letters count as delivered 14 days later." },
  { id: "electronic", label: "e-Doręczenia", help: "The date the message arrived in your e-Doręczenia inbox." },
];
const FACT_LABEL: Record<string, string> = { caseNumber: "Case number", office: "Office", filedAt: "Filed on", upoReceivedAt: "Receipt (UPO) date", mosStatus: "MOS status", inpolStatus: "inPOL status" };

/** Confirms what was read and writes it to the case: facts, the letter, its tasks and a cited deadline. */
export function LookConfirm({ read }: { read: LookRead }) {
  const isLetter = !!read.letter && (read.kind === "letter" || read.kind === "decision");
  const rule = read.letter?.deadlineRule;
  const needsDelivery = isLetter && !!rule?.amount && rule.from === "delivery";
  const [via, setVia] = useState<Via>("delivered");
  const [date, setDate] = useState(warsawToday());
  const [facts, setFacts] = useState<Record<string, string>>(() => ({ ...read.facts }) as Record<string, string>);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CommitResult | null>(null);
  const factKeys = Object.keys(facts);
  if (!isLetter && factKeys.length === 0) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    const corrections = Object.fromEntries(Object.entries(facts).filter(([k, v]) => v.trim() && v !== (read.facts as Record<string, string>)[k]));
    const delivery: CommitRequest["delivery"] = needsDelivery ? (via === "notice" ? { kind: "notice", firstNoticeDate: date } : { kind: via, date }) : undefined;
    try {
      setDone(await commitLook({ lookId: read.lookId, delivery, corrections: Object.keys(corrections).length ? corrections : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save to your case.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const added = [
      done.deadline && "a deadline with its working",
      done.taskIds.length > 0 && `${done.taskIds.length} task${done.taskIds.length === 1 ? "" : "s"}`,
      done.documentId && "this letter",
      done.factsWritten.length > 0 && done.factsWritten.map((k) => FACT_LABEL[k]?.toLowerCase() ?? k).join(", "),
    ].filter(Boolean) as string[];
    return (
      <div className="stack" style={{ ["--gap" as string]: "14px" }}>
        {done.deadline && <CitedDeadline deadline={done.deadline} />}
        <div className="lk-saved" role="status">
          <Icon name="check" size={18} />
          <span className="grow">Added to your case: {added.join(" · ") || "nothing new"}.</span>
          <Link className="btn btn-small" href="/app">Open case</Link>
        </div>
      </div>
    );
  }

  return (
    <section className="card lk-confirm stack" style={{ ["--gap" as string]: "14px" }} aria-label="Add to your case">
      <div>
        <h3>Add this to your case</h3>
        <p className="small muted" style={{ margin: 0 }}>Check what I read. Nothing is saved until you confirm.</p>
      </div>
      {factKeys.length > 0 && (
        <dl className="lk-facts">
          {factKeys.map((k) => (
            <div key={k} className="lk-fact">
              <dt>{FACT_LABEL[k] ?? k}{read.uncertain.includes(k) && <span className="chip chip-warn" style={{ marginLeft: 8 }}>Check this</span>}</dt>
              {editing === k ? (
                <dd><input className="input" value={facts[k]} onChange={(e) => setFacts({ ...facts, [k]: e.target.value })} onBlur={() => setEditing(null)} autoFocus aria-label={FACT_LABEL[k] ?? k} /></dd>
              ) : (
                <dd><span className="mono">{facts[k]}</span><button type="button" className="btn btn-ghost btn-small" onClick={() => setEditing(k)}>Edit</button></dd>
              )}
            </div>
          ))}
        </dl>
      )}
      {isLetter && rule?.amount && rule.from === "letter_date" && read.letter?.dateOnLetter && (
        <p className="small" style={{ margin: 0 }}>The deadline counts from the date on the letter, {longDate(read.letter.dateOnLetter)}.</p>
      )}
      {needsDelivery && (
        <fieldset className="lk-via">
          <legend className="label">How did this letter reach you?</legend>
          <div className="seg" role="radiogroup">
            {VIA.map((v) => (
              <label key={v.id}>
                <input type="radio" name="via" value={v.id} checked={via === v.id} onChange={() => setVia(v.id)} />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
          <p className="tiny muted" style={{ margin: "8px 0 10px" }}>{VIA.find((v) => v.id === via)?.help}</p>
          <DatePicker value={date} onChange={setDate} max={warsawToday()} ariaLabel={via === "notice" ? "Date on the first notice slip" : "Date it reached you"} />
        </fieldset>
      )}
      {error && <div className="error-box small" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary btn-block" onClick={() => void save()} disabled={busy}>
        {busy ? <><span className="spinner" aria-hidden="true" /> Working out your deadline…</> : needsDelivery ? "Work out my deadline and save" : "Save to my case"}
      </button>
    </section>
  );
}
