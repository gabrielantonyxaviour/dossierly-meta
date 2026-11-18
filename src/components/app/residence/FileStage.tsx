"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Pill } from "@/components/ui";
import { DatePicker } from "@/components/ui/DatePicker";
import type { CaseSnapshot } from "@/lib/case/types";
import { warsawToday } from "@/lib/case/next-step";
import { fileByDate } from "@/lib/residence/dates";
import { useT } from "@/lib/i18n/client";
import { Activity, Block, Fact } from "@/components/residence/parts";
import { shortDate } from "./format";
import { useResidence } from "./useResidence";

/* Stage 2 · File in MOS: the walk-through (Agent Activity-1: only the person signs and sends) and the UPO receipt,
   read by Look or typed in. The UPO is what makes the application count as filed (art. 106d ust. 6). */

const WORK = new Set(["temporary_residence_work", "temporary_residence_blue_card"]);

function ManualReceipt() {
  const t = useT("residence");
  const { act, busy } = useResidence();
  const router = useRouter();
  const [on, setOn] = useState("");
  const [no, setNo] = useState("");
  const [err, setErr] = useState("");
  const save = async () => {
    if (!on) return setErr(t("filedOnNeeded"));
    setErr("");
    if (await act({ action: "filed", filedOn: on, caseNumber: no.trim() || null }, t("filedSaved"))) router.push("/app/residence/waiting");
  };
  return (
    <form className="rs-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="ob-field">
        <span className="ob-field-label" id="rs-filed-on">{t("filedOn")}</span>
        <DatePicker value={on} onChange={setOn} min="2020-01-01" max={warsawToday()} labelledBy="rs-filed-on" placeholder={t("chooseDate")} />
      </div>
      <label className="ob-field">
        <span>{t("caseNumber")} <em className="rs-optional">{t("optional")}</em></span>
        <input className="input ui-num" maxLength={80} value={no} placeholder="WSC-II-P.6151.48213.2026" autoComplete="off" onChange={(e) => setNo(e.target.value)} />
      </label>
      {err && <p className="rs-err" role="alert">{err}</p>}
      <Button type="submit" variant="secondary" disabled={busy} loading={busy}>{t("saveFiling")}</Button>
    </form>
  );
}

export function FileStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const [typing, setTyping] = useState(false);
  const filed = c.facts.filedAt?.value ?? c.facts.upoReceivedAt?.value ?? null;
  const caseNo = c.facts.caseNumber?.value ?? null;
  const upo = c.documents.find((d) => d.kind === "upo");
  const steps = [
    { title: t("mos1"), sub: "mos.cudzoziemcy.gov.pl" },
    { title: t("mos2"), sub: t("mos2Sub") },
    { title: t("mos3"), sub: t("mos3Sub") },
    ...(WORK.has(c.profile.permitType ?? "") ? [{ title: t("mos4"), sub: t("mos4Sub") }] : []),
    { title: t("mos5"), sub: t("mos5Sub") },
    { title: t("mos6"), sub: t("mos6Sub") },
  ];
  return (
    <>
      <p className="rp-lead">{t("fileLead")}</p>
      {c.profile.legalStayUntil && !filed && <Fact icon="calendar" tone="deadline" title={t("fileByShort", { date: shortDate(fileByDate(c.profile.legalStayUntil)) })} sub={t("fileByBody")} />}
      <Activity
        title={t("walkthrough")}
        badge={<Pill tone={filed ? "ok" : "warn"}>{filed ? t("filed") : t("inProgress")}</Pill>}
        steps={steps.map((s, i) => ({ ...s, state: filed ? "done" : "you", tag: !filed && i === steps.length - 2 ? { tone: "warn", text: t("onlyYou") } : undefined }))}
        foot={<><span className="ui-meta">{t("neverSigns")}</span><ButtonLink size="sm" variant="primary" icon="prepare" href="/app/mos-sheet">{t("openFieldSheet")}</ButtonLink></>}
      />
      <Block title={t("yourReceipt")}>
        {filed ? (
          <div className="rp-stack">
            <Fact icon="check" tone="ok" title={upo ? t("upoSaved") : t("filingSaved")} sub={t("filedOnSub", { date: shortDate(filed) })} />
            {caseNo ? <Fact icon="file" title={<span className="ui-num">{caseNo}</span>} sub={t("caseNumber")} />
              : <Fact icon="file" tone="warn" title={t("noCaseNumberYet")} sub={t("noCaseNumberYetSub")} />}
            <ButtonLink href="/app/residence/waiting" variant="primary" iconEnd="forward">{t("goWaiting")}</ButtonLink>
          </div>
        ) : (
          <div className="rp-stack">
            <p className="rp-lead">{t("upoLead")}</p>
            <ButtonLink href="/app/look?hint=upo" variant="primary" icon="scan">{t("addUpo")}</ButtonLink>
            {typing ? <ManualReceipt /> : <Button variant="ghost" onClick={() => setTyping(true)}>{t("typeItIn")}</Button>}
          </div>
        )}
      </Block>
      <p className="rp-note">{t("mosDown")}</p>
    </>
  );
}
