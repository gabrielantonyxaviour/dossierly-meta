"use client";
import type { NextStep } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { ButtonLink, Pill } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { longDay, timeLabel } from "../format";

function href(n: NextStep): string {
  if (n.kind === "deadline" && n.id) return `/app/case/deadlines/${n.id}`;
  if (n.kind === "document" && n.id) return `/app/case/documents/${n.id}`;
  if (n.kind === "appointment") return "/app/case?tab=dates";
  if (n.kind === "task") return "/app/case?tab=tasks";
  return "/app/case";
}

/** The single most urgent thing, with a countdown when it is dated. */
export function NextStepCard({ next, snapshot }: { next: NextStep | null; snapshot: CaseSnapshot }) {
  const t = useT("home");
  if (!next) {
    return (
      <section className="hm-next hm-next--calm" aria-labelledby="next-title">
        <span className="ui-eyebrow">{t("yourNextStep")}</span>
        <h2 id="next-title" className="hm-next-title">{t("nothingUrgent")}</h2>
        <p className="ui-body">{t("nothingUrgentBody")}</p>
      </section>
    );
  }
  const dated = next.daysLeft !== null && next.date;
  const urgent = next.overdue || (next.daysLeft !== null && next.daysLeft <= 7);
  const deadline = next.kind === "deadline" ? snapshot.deadlines.find((d) => d.id === next.id) : undefined;
  const task = next.kind === "task" ? snapshot.tasks.find((t) => t.id === next.id) : undefined;
  const appt = next.kind === "appointment" ? snapshot.appointments.find((a) => a.id === next.id) : undefined;
  const apptToday = !!appt && next.daysLeft === 0;
  const ask = encodeURIComponent(t("askNext", { title: next.title }));
  const attach = next.kind === "deadline" || next.kind === "task" || next.kind === "document" ? `&attach=${next.kind}:${next.id}` : "";
  return (
    <section className={`hm-next${urgent && next.kind !== "appointment" ? " hm-next--urgent" : ""}`} aria-labelledby="next-title">
      <div className="hm-next-top">
        <span className="ui-eyebrow">{t("yourNextStep")}</span>
        <Pill tone={next.kind === "deadline" ? (urgent ? "deadline" : "warn") : next.kind === "appointment" ? "official" : "neutral"} dot>
          {t(`kind_${next.kind}`)}{deadline?.computation.rule ? ` · ${deadline.computation.rule}` : ""}
        </Pill>
      </div>
      <div className="hm-next-body">
        {apptToday && (
          <div className="hm-count" aria-label={t("todayAt", { time: timeLabel(appt!.at) })}>
            <span className="hm-count-n ui-display ui-num">{timeLabel(appt!.at)}</span>
            <span className="hm-count-u">{t("todayUnit")}</span>
          </div>
        )}
        {dated && !apptToday && (
          <div className="hm-count" aria-label={next.overdue ? t("daysOverdueAria", { n: -next.daysLeft! }) : t("daysLeftAria", { n: next.daysLeft! })}>
            <span className="hm-count-n ui-display ui-num">{next.overdue ? -next.daysLeft! : next.daysLeft}</span>
            <span className="hm-count-u">{next.overdue ? t("unitDaysOverdue") : next.daysLeft === 1 ? t("unitDayLeft") : next.daysLeft === 0 ? t("unitDueToday") : t("unitDaysLeft")}</span>
          </div>
        )}
        <div className="hm-next-text">
          <h2 id="next-title" className="hm-next-title">{next.title}</h2>
          {dated && <p className="hm-next-date">{appt ? `${apptToday ? t("today") : longDay(next.date!)} · ${appt.location.address || appt.location.name}` : t("dueOn", { date: longDay(next.date!) })}</p>}
          <p className="ui-body">{task?.detail || next.reason}</p>
        </div>
      </div>
      <div className="hm-next-actions">
        <ButtonLink href={href(next)} variant="primary" iconEnd="forward">{next.kind === "deadline" ? t("howCounted") : t("open")}</ButtonLink>
        <ButtonLink href={`/app/chat?q=${ask}${attach}`} variant="secondary" icon="sparkle">{t("ask")}</ButtonLink>
      </div>
    </section>
  );
}
