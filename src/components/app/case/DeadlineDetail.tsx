"use client";
import { daysBetween, warsawToday } from "@/lib/case/next-step";
import { ButtonLink, Card, EmptyState, Pill, Row, Section, Skeleton, StickyActionBar, TopBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { longDay } from "../format";
import { useCaseData } from "../shell/case-data";
import "./case.css";

/** One deadline: countdown, the counting steps, the legal rule and what it's for. */
export function DeadlineDetail({ id }: { id: string }) {
  const { snapshot, status } = useCaseData();
  const back = { href: "/app/case?tab=dates", label: "Back to dates" };
  if (status === "loading") return <div className="sh-page"><TopBar title="Deadline" back={back} large={false} /><Skeleton h={180} r={22} /></div>;
  const d = snapshot?.deadlines.find((x) => x.id === id);
  if (!snapshot || !d) return <div className="sh-page"><TopBar title="Deadline" back={back} large={false} /><EmptyState icon="clock" title="Deadline not found" action={<ButtonLink href="/app/case?tab=dates" size="sm">All dates</ButtonLink>}>It may have been removed or replaced by a newer count.</EmptyState></div>;
  const left = daysBetween(warsawToday(), d.dueDate);
  const urgent = d.status === "open" && left <= 7;
  const trigger = d.triggeredBy ? snapshot.documents.find((x) => x.id === d.triggeredBy) ?? null : null;
  const tasks = snapshot.tasks.filter((t) => t.dueDeadlineId === d.id);
  const q = encodeURIComponent(`Explain this deadline and what I should do: ${d.title}`);
  return (
    <div className="sh-page sh-page--actions">
      <TopBar title={d.title} back={back} eyebrow={d.computation.rule ?? "Deadline"} actions={<Pill tone={d.status === "done" ? "ok" : d.status === "missed" ? "deadline" : urgent ? "deadline" : "neutral"} dot>{d.status === "open" ? "Open" : d.status === "done" ? "Done" : "Missed"}</Pill>} />
      <Card className="dt-hero" raised>
        <div className={`dt-due${urgent ? " dt-due--urgent" : ""}`}>
          {d.status === "open" && <span className="ui-display ui-num">{Math.abs(left)}</span>}
          <span className="ui-body">{d.status !== "open" ? "" : left < 0 ? "days overdue" : left === 0 ? "due today" : left === 1 ? "day left" : "days left"}</span>
        </div>
        <p className="ui-title">Due {longDay(d.dueDate)}</p>
        <p className="ui-meta">Polish calendar day (Europe/Warsaw). Send or file before the office closes that day.</p>
      </Card>

      <Section title="How this date was counted">
        <Card>
          {d.computation.steps.length ? (
            <ol className="dt-steps">{d.computation.steps.map((s, i) => <li key={i}><p>{s}</p></li>)}</ol>
          ) : <p className="ui-body">No counting steps were recorded for this date.</p>}
        </Card>
      </Section>

      {(d.computation.rule || d.computation.legalRefUrl) && (
        d.computation.legalRefUrl ? (
          <a className="dt-law" href={d.computation.legalRefUrl} target="_blank" rel="noreferrer">
            <Icon name="scale" size={22} />
            <span><b>{d.computation.rule ?? "Legal source"}</b><small>Read the official text (ISAP, Sejm)</small></span>
            <Icon name="external" size={18} />
          </a>
        ) : <div className="dt-law"><Icon name="scale" size={22} /><span><b>{d.computation.rule}</b></span></div>
      )}

      {trigger && (
        <Section title="Started by">
          <Card flush><Row href={`/app/case/documents/${trigger.id}`} chevron icon="letter" iconBg="var(--official-soft)" iconColor="var(--official)" title={trigger.title} sub={trigger.source === "email" ? "Received by email" : "In your documents"} /></Card>
        </Section>
      )}

      {tasks.length > 0 && (
        <Section title="To do before then" action={{ label: "Tasks", href: "/app/case?tab=tasks" }}>
          <Card flush>{tasks.map((t) => <Row key={t.id} icon="task" iconBg={t.status === "done" ? "var(--ok-soft)" : undefined} iconColor={t.status === "done" ? "var(--ok)" : undefined} title={t.title} sub={t.detail || undefined} end={t.status === "done" ? <Pill tone="ok">Done</Pill> : undefined} />)}</Card>
        </Section>
      )}

      <p className="ui-meta">Dossierly explains how deadlines are counted. It isn’t legal advice: if the date matters for an appeal, confirm it with the office or a licensed adviser.</p>
      <StickyActionBar>
        <ButtonLink href={`/app/chat?q=${q}&attach=deadline:${d.id}`} variant="primary" icon="sparkle">Ask Dossierly about this</ButtonLink>
      </StickyActionBar>
    </div>
  );
}
