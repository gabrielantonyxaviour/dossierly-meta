"use client";
import type { NextStep } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { ButtonLink, Pill } from "@/components/ui";
import { longDay } from "../format";

const KIND_LABEL: Record<NextStep["kind"], string> = { deadline: "Deadline", appointment: "Appointment", task: "To do", document: "Document", stage: "Next step" };

function href(n: NextStep): string {
  if (n.kind === "deadline" && n.id) return `/app/case/deadlines/${n.id}`;
  if (n.kind === "document" && n.id) return `/app/case/documents/${n.id}`;
  if (n.kind === "appointment") return "/app/case?tab=dates";
  if (n.kind === "task") return "/app/case?tab=tasks";
  return "/app/case";
}

/** The single most urgent thing, with a countdown when it is dated. */
export function NextStepCard({ next, snapshot }: { next: NextStep | null; snapshot: CaseSnapshot }) {
  if (!next) {
    return (
      <section className="hm-next hm-next--calm" aria-labelledby="next-title">
        <span className="ui-eyebrow">Your next step</span>
        <h2 id="next-title" className="hm-next-title">Nothing urgent right now</h2>
        <p className="ui-body">Dossierly is watching your mail and calendar. When a letter or date arrives, it shows up here first.</p>
      </section>
    );
  }
  const dated = next.daysLeft !== null && next.date;
  const urgent = next.overdue || (next.daysLeft !== null && next.daysLeft <= 7);
  const deadline = next.kind === "deadline" ? snapshot.deadlines.find((d) => d.id === next.id) : undefined;
  const task = next.kind === "task" ? snapshot.tasks.find((t) => t.id === next.id) : undefined;
  const ask = encodeURIComponent(`Walk me through my next step: ${next.title}`);
  const attach = next.kind === "deadline" || next.kind === "task" || next.kind === "document" ? `&attach=${next.kind}:${next.id}` : "";
  return (
    <section className={`hm-next${urgent && next.kind !== "appointment" ? " hm-next--urgent" : ""}`} aria-labelledby="next-title">
      <div className="hm-next-top">
        <span className="ui-eyebrow">Your next step</span>
        <Pill tone={next.kind === "deadline" ? (urgent ? "deadline" : "warn") : next.kind === "appointment" ? "official" : "neutral"} dot>
          {KIND_LABEL[next.kind]}{deadline?.computation.rule ? ` · ${deadline.computation.rule}` : ""}
        </Pill>
      </div>
      <div className="hm-next-body">
        {dated && (
          <div className="hm-count" aria-label={next.overdue ? `${-next.daysLeft!} days overdue` : `${next.daysLeft} days left`}>
            <span className="hm-count-n ui-display ui-num">{next.overdue ? -next.daysLeft! : next.daysLeft}</span>
            <span className="hm-count-u">{next.overdue ? "days overdue" : next.daysLeft === 1 ? "day left" : next.daysLeft === 0 ? "due today" : "days left"}</span>
          </div>
        )}
        <div className="hm-next-text">
          <h2 id="next-title" className="hm-next-title">{next.title}</h2>
          {dated && <p className="hm-next-date">{next.kind === "appointment" ? "On" : "Due"} {longDay(next.date!)}</p>}
          <p className="ui-body">{task?.detail || next.reason}</p>
        </div>
      </div>
      <div className="hm-next-actions">
        <ButtonLink href={href(next)} variant="primary" iconEnd="forward">{next.kind === "deadline" ? "See how it’s counted" : "Open"}</ButtonLink>
        <ButtonLink href={`/app/chat?q=${ask}${attach}`} variant="secondary" icon="sparkle">Ask</ButtonLink>
      </div>
    </section>
  );
}
