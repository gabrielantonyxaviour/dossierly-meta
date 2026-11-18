"use client";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, CheckCircle, Pill } from "@/components/ui";
import type { CaseSnapshot } from "@/lib/case/types";
import { warsawToday } from "@/lib/case/next-step";
import { checklist, GROUP_ORDER, type CheckItem } from "@/lib/residence/checklist";
import { daysToFile, fileByDate, startByDate } from "@/lib/residence/dates";
import { FEE_ACCOUNTS, VOIVODESHIP_INFO } from "@/lib/residence/model";
import { useT } from "@/lib/i18n/client";
import { Block, StatusLine } from "@/components/residence/parts";
import { shortDate } from "./format";
import { useResidence } from "./useResidence";

/* Stage 1 · Prepare: the ground-specific checklist, ticks saved to the case, fees as two transfers per person. */

function FeeAccount({ c, item }: { c: CaseSnapshot; item: CheckItem }) {
  const t = useT("residence");
  const region = c.profile.voivodeship;
  const acc = region ? FEE_ACCOUNTS[region] : undefined;
  const kind = item.id.startsWith("fee_stamp") ? "stamp" : "card";
  if (!acc) return <span className="rs-account">{t("feeAccountElsewhere")}</span>;
  return (
    <span className="rs-account">
      <span>{acc[kind].to}</span>
      <code>{acc[kind].account}</code>
    </span>
  );
}

function Row({ c, item, onTick, busy }: { c: CaseSnapshot; item: CheckItem; onTick: (done: boolean) => void; busy: boolean }) {
  const t = useT("residence");
  const region = c.profile.voivodeship ? VOIVODESHIP_INFO[c.profile.voivodeship] : null;
  const vars = { ...item.vars, seat: region?.seat ?? t("yourCity"), office: region?.office ?? t("yourVoivodeOffice") };
  const title = t(`check_${item.key}`, vars);
  return (
    <li className={`rs-check-row${item.done ? " is-done" : ""}`}>
      <CheckCircle checked={item.done} disabled={busy || item.auto} label={item.done ? t("untick", { title }) : t("tick", { title })} onChange={onTick} />
      <span className="rp-check-main">
        <b>{title}</b>
        <span>{item.auto ? t("autoTicked") : t(`check_${item.key}Sub`, vars)}</span>
        {item.group === "fees" && <FeeAccount c={c} item={item} />}
        {item.group === "fees" && item.id.endsWith("_me") && c.profile.employerPays === "yes" && <span>{t("paysYesSub")}</span>}
      </span>
      <span className="rs-check-end">
        {item.href && !item.done && <ButtonLink href={item.href} size="sm" variant="secondary" icon="camera">{t("checkPhoto")}</ButtonLink>}
        {item.id === "annex" && !item.done && <Pill tone="warn">{t("waitingOnEmployer")}</Pill>}
      </span>
    </li>
  );
}

export function PrepareStage({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const { act, busy } = useResidence();
  const router = useRouter();
  const items = checklist(c);
  const done = items.filter((i) => i.done).length;
  const until = c.profile.legalStayUntil;
  const today = warsawToday();
  const left = until ? daysToFile(until, today) : null;
  return (
    <>
      <StatusLine
        word={t("readyCount", { done, total: items.length })}
        tone={left !== null && left <= 14 ? "deadline" : "user"}
        sub={until ? (left! >= 0 ? t("fileByLeft", { date: shortDate(fileByDate(until)), n: left! }) : t("fileByPassedShort")) : t("noEndDate")}
        pct={(done / Math.max(1, items.length)) * 100}
        left={until ? t("startBy", { date: shortDate(startByDate(until)) }) : t("today")}
        right={until ? t("fileByShort", { date: shortDate(fileByDate(until)) }) : "—"}
      />
      {!until && <ButtonLink href="/app/residence/start" variant="secondary" icon="calendar">{t("addEndDate")}</ButtonLink>}
      {GROUP_ORDER.map((g) => {
        const rows = items.filter((i) => i.group === g);
        if (!rows.length) return null;
        return (
          <Block key={g} title={t(`group_${g}`)} aside={<span className="ui-meta ui-num">{rows.filter((r) => r.done).length}/{rows.length}</span>}>
            <ul className="rp-check">
              {rows.map((it) => <Row key={it.id} c={c} item={it} busy={busy} onTick={(v) => void act({ action: "tick", item: it.id, done: v })} />)}
            </ul>
            {g === "fees" && <p className="rp-note">{t("feesNote")}</p>}
          </Block>
        );
      })}
      <p className="rp-note">{t("prepareNote")}</p>
      <div className="rs-actions">
        <ButtonLink href="/app/mos-sheet" variant="secondary" icon="prepare">{t("openFieldSheet")}</ButtonLink>
        <Button variant="primary" iconEnd="forward" disabled={busy} loading={busy} onClick={() => void act({ action: "stage", stage: "file" }).then((ok) => ok && router.push("/app/residence/file"))}>{t("readyToFile")}</Button>
      </div>
    </>
  );
}
