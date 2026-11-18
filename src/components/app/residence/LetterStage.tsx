"use client";
import { useState } from "react";
import { Button, ButtonLink, CheckCircle, EmptyState, Pill } from "@/components/ui";
import type { CaseDocument, CaseSnapshot } from "@/lib/case/types";
import { daysBetween, warsawToday } from "@/lib/case/next-step";
import { SUMMONS_RULES, type SummonsKind } from "@/lib/legal/summons";
import { useT } from "@/lib/i18n/client";
import { Activity, Block, Fact } from "@/components/residence/parts";
import { useCaseData } from "../shell/case-data";
import { HelpSheet } from "./HelpSheet";
import { shortDate } from "./format";

/* Stage 4 · A letter arrived. Reads what the Look / inbox pipeline saved: the letter document, its deadline and the
   tasks it asks for. The three summons kinds come from the legal engine (src/lib/legal/summons.ts). */

const KINDS: SummonsKind[] = ["formal-defect", "evidence-documents", "personal-appearance"];
const KIND_KEY: Record<SummonsKind, string> = { "formal-defect": "Formal", "evidence-documents": "Evidence", "personal-appearance": "Appear" };

export function summonsKind(text: string): SummonsKind | null {
  if (/106\s*e/i.test(text)) return "personal-appearance";
  if (/106\s*f/i.test(text)) return "evidence-documents";
  if (/\b64\b/.test(text)) return "formal-defect";
  return null;
}

function LetterView({ c, doc }: { c: CaseSnapshot; doc: CaseDocument }) {
  const t = useT("residence");
  const { patchItem } = useCaseData();
  const [polish, setPolish] = useState(false);
  const [help, setHelp] = useState(false);
  const deadline = c.deadlines.find((d) => d.triggeredBy === doc.id) ?? null;
  const tasks = deadline ? c.tasks.filter((x) => x.dueDeadlineId === deadline.id) : [];
  const f = doc.extractedFields;
  const kind = summonsKind(`${f.legalBasis ?? ""} ${deadline?.computation.rule ?? ""}`);
  const left = deadline ? daysBetween(warsawToday(), deadline.dueDate) : null;
  const open = deadline?.status === "open";
  const caseNo = f.caseNumber ?? c.facts.caseNumber?.value;
  return (
    <>
      <div className="rp-letter-head">
        <Pill tone="official" icon="letter">{kind ? t(`kind${KIND_KEY[kind]}`) : t("kindLetter")}</Pill>
        <p className="rp-lead">{[f.office, f.dateOnLetter ? t("datedOn", { date: shortDate(f.dateOnLetter) }) : null].filter(Boolean).join(" · ") || t("addedOn", { date: shortDate(doc.createdAt.slice(0, 10)) })}</p>
      </div>
      {deadline && (
        <div className="rp-deadline">
          <div><span className="ui-meta">{open ? t("lastDay") : t("deadlineClosed")}</span><b className="ui-num">{shortDate(deadline.dueDate)}</b></div>
          {open && left !== null && <div className="rp-deadline-left"><b className="ui-num">{Math.abs(left)}</b><span>{left < 0 ? t("daysOverdue") : left === 1 ? t("dayLeft") : t("daysLeft")}</span></div>}
        </div>
      )}
      {kind && <div className={`rp-callout${kind === "personal-appearance" ? " tone-deadline" : ""}`}><b>{t(`kind${KIND_KEY[kind]}`)} · {SUMMONS_RULES[kind].basis}</b><span>{t(`kind${KIND_KEY[kind]}Body`)}</span></div>}
      <Block title={t("whatItAsks")} aside={f.deadlineQuote ? <button type="button" className="rp-link" onClick={() => setPolish(!polish)}>{polish ? t("hidePolish") : t("showPolish")}</button> : undefined}>
        {polish && f.deadlineQuote && <blockquote className="rp-quote" lang="pl">{f.deadlineQuote}</blockquote>}
        {tasks.length ? (
          <ul className="rp-check">
            {tasks.map((x) => (
              <li key={x.id} className={`rs-check-row${x.status === "done" ? " is-done" : ""}`}>
                <CheckCircle checked={x.status === "done"} label={t("tick", { title: x.title })} onChange={(v) => void patchItem("tasks", x.id, { status: v ? "done" : "open" })} />
                <span className="rp-check-main"><b>{x.title}</b>{x.detail && <span lang="pl">{x.detail}</span>}</span>
                <span />
              </li>
            ))}
          </ul>
        ) : <p className="rp-note">{f.requested || t("asksNone")}</p>}
      </Block>
      <Activity
        title={t("handled")}
        badge={<Pill tone={open ? "warn" : "ok"}>{open ? t("needsYou") : t("allDone")}</Pill>}
        steps={[
          { state: "done", title: t("didRead"), sub: t("didReadSub") },
          { state: "done", title: t("didLink"), sub: caseNo ?? t("didLinkSub") },
          ...(deadline ? [{ state: "done" as const, title: t("didCount"), sub: deadline.computation.rule ?? t("didCountSub") }] : []),
          { state: "you", title: t("youGather"), sub: t("youGatherSub"), tag: open ? { tone: "warn" as const, text: t("stopsForYou") } : undefined },
          { state: "you", title: t("youSend"), sub: t("youSendSub"), tag: open ? { tone: "deadline" as const, text: t("onlyYou") } : undefined },
        ]}
        foot={<><span className="ui-meta">{t("neverSends")}</span><ButtonLink size="sm" variant="secondary" icon="look" href={`/app/look?doc=${encodeURIComponent(doc.id)}`}>{t("seeOnPage")}</ButtonLink></>}
      />
      {deadline && deadline.computation.steps.length > 0 && (
        <Block title={t("howCounted")}>
          <ol className="rp-count">{deadline.computation.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <p className="rp-note">{t("moreTime")}</p>
        </Block>
      )}
      <Button variant="secondary" icon="help" block onClick={() => setHelp(true)}>{t("talkToPerson")}</Button>
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </>
  );
}

function SummonsKinds() {
  const t = useT("residence");
  return (
    <Block title={t("threeKinds")}>
      <div className="rs-kinds">
        {KINDS.map((k) => <Fact key={k} icon={k === "personal-appearance" ? "pin" : "letter"} tone={k === "personal-appearance" ? "deadline" : "official"} title={`${t(`kind${KIND_KEY[k]}`)} · ${SUMMONS_RULES[k].basis}`} sub={t(`kind${KIND_KEY[k]}Body`)} />)}
      </div>
    </Block>
  );
}

export function LetterStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const letters = c.documents.filter((d) => d.kind === "letter").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const openFirst = [...letters].sort((a, b) => Number(!!c.deadlines.find((d) => d.triggeredBy === b.id && d.status === "open")) - Number(!!c.deadlines.find((d) => d.triggeredBy === a.id && d.status === "open")));
  const [pick, setPick] = useState<string | null>(openFirst[0]?.id ?? null);
  const doc = letters.find((d) => d.id === pick) ?? openFirst[0];
  if (!doc) {
    return (
      <>
        <EmptyState icon="letter" title={t("noLetterTitle")} action={<ButtonLink href="/app/look" variant="primary" icon="scan">{t("readALetter")}</ButtonLink>}>{t("noLetterBody")}</EmptyState>
        <SummonsKinds />
      </>
    );
  }
  return (
    <>
      {letters.length > 1 && (
        <div className="rs-letters" role="group" aria-label={t("yourLetters")}>
          {letters.slice(0, 5).map((d) => (
            <button key={d.id} type="button" className="rs-letter-pick" aria-pressed={d.id === doc.id} onClick={() => setPick(d.id)}>
              <Fact icon="letter" tone={d.id === doc.id ? "official" : undefined} title={d.title} sub={shortDate(d.createdAt.slice(0, 10))} />
            </button>
          ))}
        </div>
      )}
      <LetterView key={doc.id} c={c} doc={doc} />
      <SummonsKinds />
      <div className="rs-actions">
        <ButtonLink href="/app/look" variant="secondary" icon="scan">{t("readAnother")}</ButtonLink>
        <ButtonLink href="/app/case?tab=documents" variant="ghost" icon="letter">{t("allLetters")}</ButtonLink>
      </div>
    </>
  );
}
