"use client";
import { daysBetween, warsawToday } from "@/lib/case/next-step";
import type { CaseDocument, CaseSnapshot } from "@/lib/case/types";
import { ButtonLink, Card, CheckCircle, EmptyState, Pill, Row, Section, useToast } from "@/components/ui";
import type { IconName } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { dayLabel, relDays } from "../format";
import { useCaseData } from "../shell/case-data";
import { isMissingPhoto, isPhotoTask, openPhotoTask, photoCheckHref } from "../photo-link";
import { CaseCalendar } from "./CaseCalendar";
import { caseDates, type DateItem } from "./calendar-grid";

export function DatesTab({ c }: { c: CaseSnapshot }) {
  const t = useT("case");
  const today = warsawToday();
  type Item = DateItem;
  const items = caseDates(c, t);
  const upcoming = items.filter((i) => i.date >= today && i.status !== "done").sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((i) => i.date < today || i.status === "done").sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return <EmptyState icon="calendar" title={t("noDates")}>{t("noDatesBody")}</EmptyState>;
  const row = (i: Item) => {
    const left = daysBetween(today, i.date);
    const done = i.status === "done";
    return (
      <Row key={i.key} href={i.href} chevron={!!i.href}
        icon={i.kind === "deadline" ? "clock" : "calendar"}
        iconBg={done ? undefined : i.kind === "deadline" ? "var(--deadline-soft)" : "var(--official-soft)"}
        iconColor={done ? undefined : i.kind === "deadline" ? "var(--deadline)" : "var(--official)"}
        title={i.title}
        sub={`${dayLabel(i.date, { year: left < -60 })}${i.time ? ` · ${i.time}` : ""} · ${i.sub}`}
        end={done ? <Pill tone="ok">{t("done")}</Pill> : i.status === "missed" ? <Pill tone="deadline">{t("missed")}</Pill> : left >= 0 ? <Pill tone={i.kind === "deadline" && left <= 7 ? "deadline" : "neutral"}>{relDays(left)}</Pill> : undefined}
      />
    );
  };
  return (
    <div className="cs-stack">
      <CaseCalendar items={items} today={today} row={row} />
      <Section title={t("upcoming")}>{upcoming.length ? <Card flush>{upcoming.map(row)}</Card> : <p className="ui-body">{t("nothingComing")}</p>}</Section>
      {past.length > 0 && <Section title={t("past")}>{<Card flush>{past.map(row)}</Card>}</Section>}
    </div>
  );
}

const DOC_ICON: Record<CaseDocument["kind"], IconName> = { passport: "book", rental_agreement: "home", health_insurance: "shield", university_certificate: "file", photo: "photo", upo: "check", letter: "letter", other: "file" };
/** Labels are "case" messages: doc_have, doc_missing, doc_requested. */
const DOC_TONE = { have: "ok", missing: "deadline", requested: "warn" } as const;
const pagesLabel = (t: T, n: number) => (n === 1 ? t("pagesOne") : t("pagesMany", { n }));

export function DocumentsTab({ c }: { c: CaseSnapshot }) {
  const t = useT("case");
  if (!c.documents.length) return <EmptyState icon="file" title={t("noDocs")} action={<ButtonLink href="/app/look" size="sm" icon="scan">{t("addWithLook")}</ButtonLink>}>{t("noDocsBody")}</EmptyState>;
  const order = { missing: 0, requested: 1, have: 2 } as const;
  const docs = [...c.documents].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  const need = docs.filter((d) => d.status !== "have");
  const have = docs.filter((d) => d.status === "have");
  const photoTask = openPhotoTask(c);
  const row = (d: CaseDocument) => (
    <Row key={d.id} href={isMissingPhoto(d) ? photoCheckHref(photoTask?.id) : `/app/case/documents/${d.id}`} chevron icon={DOC_ICON[d.kind]} title={d.title}
      sub={[d.pages ? pagesLabel(t, d.pages) : null, Object.keys(d.extractedFields).length ? t("fieldsRead", { n: Object.keys(d.extractedFields).length }) : null, d.source === "email" ? t("fromEmail") : d.source === "scan" ? t("scanned") : null].filter(Boolean).join(" · ") || undefined}
      end={<Pill tone={DOC_TONE[d.status]}>{t(`doc_${d.status}`)}</Pill>} />
  );
  return (
    <div className="cs-stack">
      {need.length > 0 && <Section title={t("stillNeeded")}>{<Card flush>{need.map(row)}</Card>}</Section>}
      <Section title={t("inYourCase")} action={{ label: t("add"), href: "/app/look" }}>{have.length ? <Card flush>{have.map(row)}</Card> : <p className="ui-body">{t("nothingFiled")}</p>}</Section>
    </div>
  );
}

export function TasksTab({ c }: { c: CaseSnapshot }) {
  const t = useT("case");
  const { patchItem } = useCaseData();
  const { toast } = useToast();
  const dl = new Map(c.deadlines.map((d) => [d.id, d]));
  const open = c.tasks.filter((t) => t.status === "open");
  const done = c.tasks.filter((t) => t.status === "done");
  if (!c.tasks.length) return <EmptyState icon="task" title={t("noTasks")}>{t("noTasksBody")}</EmptyState>;
  const toggle = async (id: string, to: "open" | "done") => {
    const ok = await patchItem("tasks", id, { status: to });
    if (!ok) toast(t("saveFailed"), { tone: "error" });
  };
  const ORIGINS = ["counter", "letter", "email", "agent", "user"];
  const row = (task: CaseSnapshot["tasks"][number]) => {
    const d = task.dueDeadlineId ? dl.get(task.dueDeadlineId) : undefined;
    const left = d ? daysBetween(warsawToday(), d.dueDate) : null;
    return (
      <Row key={task.id} className={task.status === "done" ? "cs-done" : undefined}
        icon={<CheckCircle checked={task.status === "done"} label={task.status === "done" ? t("reopen", { title: task.title }) : t("markDone", { title: task.title })} onChange={(v) => void toggle(task.id, v ? "done" : "open")} />}
        title={task.title}
        sub={<>
          {[task.detail, d ? t("forDeadline", { title: d.title }) : null, ORIGINS.includes(task.origin) ? t(`origin_${task.origin}`) : null].filter(Boolean).join(" · ")}
          {task.status === "open" && isPhotoTask(task) && <span className="ui-row-action"><ButtonLink href={photoCheckHref(task.id)} size="sm" variant="primary" icon="camera">{t("checkPhoto")}</ButtonLink></span>}
        </>}
        end={task.status === "open" && left !== null ? <Pill tone={left <= 7 ? "deadline" : "neutral"}>{left < 0 ? t("overdue") : t("daysShort", { n: left })}</Pill> : undefined} />
    );
  };
  return (
    <div className="cs-stack">
      <Section title={t("openSection")}>{open.length ? <Card flush>{open.map(row)}</Card> : <p className="ui-body">{t("allDone")}</p>}</Section>
      {done.length > 0 && <Section title={t("done")}>{<Card flush>{done.map(row)}</Card>}</Section>}
    </div>
  );
}
