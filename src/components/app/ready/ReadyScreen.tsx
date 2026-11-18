"use client";
import Link from "next/link";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Pill, Row, Section, Skeleton, TopBar, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { ago, dayLabel, timeLabel } from "../format";
import { useCaseData } from "../shell/case-data";
import { shortTitle } from "../case/KeyCards";
import { CHANNEL_KEYS, LANG_KEYS, latestReady, type Draft } from "./derive";
import "./ready.css";

const dayOffset = (iso: string, today: string) => daysBetween(today, warsawDate(iso));
const relDay = (iso: string, today: string, t: T) => {
  const n = dayOffset(iso, today);
  return n === 0 ? t("today") : n === 1 ? t("tomorrow") : dayLabel(warsawDate(iso));
};

function DraftCard({ d }: { d: Draft }) {
  const t = useT("ready");
  const { toast } = useToast();
  const lang = LANG_KEYS.includes(d.language) ? t(`lang_${d.language}`) : d.language.toUpperCase();
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.text); toast(t("draftCopied"), { tone: "ok" }); } catch { toast(t("copyFailed"), { tone: "error" }); }
  };
  const q = encodeURIComponent(t("askDraftQ", { title: d.doc.title }));
  return (
    <article className="rd-draft">
      <header className="rd-draft-head">
        <h3>{d.doc.title.replace(/\s*\(draft\)\s*$/i, "")}</h3>
        <Pill tone="agent">{lang ? t("langDraft", { lang }) : t("draft")}</Pill>
      </header>
      {d.to && <p className="rd-to"><span>{t("to")}</span>{d.to}</p>}
      {d.subject && <p className="rd-subject">{d.subject}</p>}
      <div className="rd-paper" lang={d.language || undefined}>{d.text}</div>
      <footer className="rd-draft-foot">
        <Button size="sm" icon="copy" onClick={() => void copy()}>{t("copy")}</Button>
        <ButtonLink size="sm" variant="ghost" icon="sparkle" href={`/app/chat?q=${q}&attach=document:${d.doc.id}`}>{t("askAboutIt")}</ButtonLink>
      </footer>
    </article>
  );
}

/** Film A8: everything the agent prepared after a new letter, in one slow-scrollable view. */
export function ReadyScreen() {
  const t = useT("ready");
  const { status, snapshot, error, refresh } = useCaseData();
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="60%" /><Skeleton h={140} r={20} /><Skeleton h={320} r={20} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? t("loadFailed")} onRetry={() => void refresh()} /></div>;
  const b = latestReady(snapshot);
  const back = { href: "/app", label: t("back") };
  if (!b) {
    return (
      <div className="sh-page">
        <TopBar title={t("title")} back={back} />
        <EmptyState icon="sparkle" title={t("nothingWaiting")} action={<ButtonLink href="/app" size="sm">{t("backHome")}</ButtonLink>}>
          {t("nothingBody")}
        </EmptyState>
      </div>
    );
  }
  const today = warsawToday();
  const d = b.deadline;
  const left = d ? daysBetween(today, d.dueDate) : 0;
  const arrivedToday = dayOffset(b.arrivedAt, today) === 0;
  const leftText = left < 0 ? t("daysOverdue", { n: -left }) : left === 0 ? t("dueToday") : left === 1 ? t("dayLeft") : t("daysLeft", { n: left });
  return (
    <div className="sh-page rd">
      <TopBar
        title={t("title")}
        back={back}
        eyebrow={arrivedToday ? t("eyebrowToday", { time: timeLabel(b.arrivedAt) }) : t("eyebrowAgo", { ago: ago(b.arrivedAt) })}
        sub={t("sub")}
      />

      {(d || b.reminder) && (
        <div className="rd-top">
          {d && (
            <Link href={`/app/case/deadlines/${d.id}`} className={`rd-due${left <= 7 ? " is-urgent" : ""}`}>
              <span className="rd-k"><Icon name="clock" size={18} />{shortTitle(d.title)}</span>
              <span className="rd-big">{t("dueOn", { date: dayLabel(d.dueDate) })}</span>
              <span className="rd-sub">{leftText}{d.computation.rule ? ` · ${d.computation.rule}` : ""}</span>
            </Link>
          )}
          {b.reminder && (
            <div className="rd-remind">
              <span className="rd-k"><Icon name="bell" size={18} />{t("reminder")}</span>
              <span className="rd-big rd-big--sm">{relDay(b.reminder.at, today, t)} {timeLabel(b.reminder.at)}</span>
              <span className="rd-sub">{CHANNEL_KEYS.includes(b.reminder.channel) ? t(`channel_${b.reminder.channel}`) : t("reminderSet")}</span>
            </div>
          )}
        </div>
      )}

      {b.drafts.length > 0 && (
        <section className="rd-drafts" aria-label={t("draftsToCheck")}>
          <h2 className="rd-h">{t("draftsToCheck")} <span>{b.drafts.length}</span></h2>
          {b.drafts.map((x) => <DraftCard key={x.doc.id} d={x} />)}
        </section>
      )}

      <Section title={t("whatHappened")}>
        <Card flush>
          <Row href={`/app/case/documents/${b.letter.id}`} chevron icon="letter" iconBg="var(--official-soft)" iconColor="var(--official)" title={b.letter.title}
            sub={`${arrivedToday ? t("arrivedToday", { time: timeLabel(b.arrivedAt) }) : t("arrivedOn", { date: relDay(b.arrivedAt, today, t), time: timeLabel(b.arrivedAt) })}${b.letter.extractedFields.asks ? ` · ${b.letter.extractedFields.asks}` : ""}`} />
          {b.call && <Row icon="phone" iconBg="var(--agent-soft)" iconColor="var(--agent-ink)" title={t("called", { time: timeLabel(b.call.at) })} sub={b.call.summary} />}
        </Card>
      </Section>
      <p className="ui-meta">{t("draftsOnly")}</p>
    </div>
  );
}
