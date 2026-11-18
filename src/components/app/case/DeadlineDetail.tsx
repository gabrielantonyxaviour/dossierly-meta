"use client";
import { daysBetween, warsawToday } from "@/lib/case/next-step";
import { ButtonLink, Card, EmptyState, Pill, Row, Section, Skeleton, StickyActionBar, TopBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { longDay } from "../format";
import { useCaseData } from "../shell/case-data";
import "./case.css";
import { isPhotoTask, photoCheckHref } from "../photo-link";

/** One deadline: countdown, the counting steps, the legal rule and what it's for. */
export function DeadlineDetail({ id }: { id: string }) {
  const t = useT("case");
  const { snapshot, status } = useCaseData();
  const back = { href: "/app/case?tab=dates", label: t("backDates") };
  if (status === "loading") return <div className="sh-page"><TopBar title={t("deadline")} back={back} large={false} /><Skeleton h={180} r={22} /></div>;
  const d = snapshot?.deadlines.find((x) => x.id === id);
  if (!snapshot || !d) return <div className="sh-page"><TopBar title={t("deadline")} back={back} large={false} /><EmptyState icon="clock" title={t("dlNotFound")} action={<ButtonLink href="/app/case?tab=dates" size="sm">{t("allDates")}</ButtonLink>}>{t("dlNotFoundBody")}</EmptyState></div>;
  const left = daysBetween(warsawToday(), d.dueDate);
  const urgent = d.status === "open" && left <= 7;
  const trigger = d.triggeredBy ? snapshot.documents.find((x) => x.id === d.triggeredBy) ?? null : null;
  const tasks = snapshot.tasks.filter((t) => t.dueDeadlineId === d.id);
  const q = encodeURIComponent(t("explainQ", { title: d.title }));
  return (
    <div className="sh-page sh-page--actions">
      <TopBar title={d.title} back={back} eyebrow={d.computation.rule ?? t("deadline")} actions={<Pill tone={d.status === "done" ? "ok" : d.status === "missed" ? "deadline" : urgent ? "deadline" : "neutral"} dot>{d.status === "open" ? t("statusOpen") : d.status === "done" ? t("done") : t("missed")}</Pill>} />
      <Card className="dt-hero" raised>
        <div className={`dt-due${urgent ? " dt-due--urgent" : ""}`}>
          {d.status === "open" && <span className="ui-display ui-num">{Math.abs(left)}</span>}
          <span className="ui-body">{d.status !== "open" ? "" : left < 0 ? t("unitDaysOverdue") : left === 0 ? t("unitDueToday") : left === 1 ? t("unitDayLeft") : t("unitDaysLeft")}</span>
        </div>
        <p className="ui-title">{t("dueOn", { date: longDay(d.dueDate) })}</p>
        <p className="ui-meta">{t("warsawNote")}</p>
      </Card>

      <Section title={t("howCounted")}>
        <Card>
          {d.computation.steps.length ? (
            <ol className="dt-steps">{d.computation.steps.map((s, i) => <li key={i}><p>{s}</p></li>)}</ol>
          ) : <p className="ui-body">{t("noSteps")}</p>}
        </Card>
      </Section>

      {(d.computation.rule || d.computation.legalRefUrl) && (
        d.computation.legalRefUrl ? (
          <a className="dt-law" href={d.computation.legalRefUrl} target="_blank" rel="noreferrer">
            <Icon name="scale" size={22} />
            <span><b>{d.computation.rule ?? t("legalSource")}</b><small>{t("readOfficial")}</small></span>
            <Icon name="external" size={18} />
          </a>
        ) : <div className="dt-law"><Icon name="scale" size={22} /><span><b>{d.computation.rule}</b></span></div>
      )}

      {trigger && (
        <Section title={t("startedBy")}>
          <Card flush><Row href={`/app/case/documents/${trigger.id}`} chevron icon="letter" iconBg="var(--official-soft)" iconColor="var(--official)" title={trigger.title} sub={trigger.source === "email" ? t("receivedEmail") : t("inDocuments")} /></Card>
        </Section>
      )}

      {tasks.length > 0 && (
        <Section title={t("todoBefore")} action={{ label: t("tab_tasks"), href: "/app/case?tab=tasks" }}>
          <Card flush>{tasks.map((task) => <Row key={task.id} href={task.status === "open" && isPhotoTask(task) ? photoCheckHref(task.id) : undefined} chevron={task.status === "open" && isPhotoTask(task)} icon={task.status === "open" && isPhotoTask(task) ? "camera" : "task"} iconBg={task.status === "done" ? "var(--ok-soft)" : undefined} iconColor={task.status === "done" ? "var(--ok)" : undefined} title={task.title} sub={task.detail || undefined} end={task.status === "done" ? <Pill tone="ok">{t("done")}</Pill> : undefined} />)}</Card>
        </Section>
      )}

      <p className="ui-meta">{t("notAdvice")}</p>
      <StickyActionBar>
        <ButtonLink href={`/app/chat?q=${q}&attach=deadline:${d.id}`} variant="primary" icon="sparkle">{t("askAboutThis")}</ButtonLink>
      </StickyActionBar>
    </div>
  );
}
