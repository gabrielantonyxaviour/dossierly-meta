"use client";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseDocument, CaseSnapshot } from "@/lib/case/types";
import { ButtonLink, Card, CheckCircle, EmptyState, Pill, Row, Section, useToast } from "@/components/ui";
import type { IconName } from "@/components/Icon";
import { dayLabel, relDays, timeLabel } from "../format";
import { useCaseData } from "../shell/case-data";
import { isMissingPhoto, isPhotoTask, openPhotoTask, photoCheckHref } from "../photo-link";

export function DatesTab({ c }: { c: CaseSnapshot }) {
  const today = warsawToday();
  type Item = { key: string; date: string; kind: "deadline" | "appointment"; title: string; sub: string; href?: string; status?: string; time?: string };
  const items: Item[] = [
    ...c.deadlines.map((d) => ({ key: d.id, date: d.dueDate, kind: "deadline" as const, title: d.title, sub: d.computation.rule ?? "Deadline", href: `/app/case/deadlines/${d.id}`, status: d.status })),
    ...c.appointments.map((a) => ({ key: a.id, date: warsawDate(a.at), kind: "appointment" as const, title: a.title, sub: `${a.location.name}${a.location.address ? ` · ${a.location.address}` : ""}`, time: timeLabel(a.at) })),
  ];
  const upcoming = items.filter((i) => i.date >= today && i.status !== "done").sort((a, b) => a.date.localeCompare(b.date));
  const past = items.filter((i) => i.date < today || i.status === "done").sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return <EmptyState icon="calendar" title="No dates yet">When a letter sets a deadline or the office gives you an appointment, it’s counted and shown here.</EmptyState>;
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
        end={done ? <Pill tone="ok">Done</Pill> : i.status === "missed" ? <Pill tone="deadline">Missed</Pill> : left >= 0 ? <Pill tone={i.kind === "deadline" && left <= 7 ? "deadline" : "neutral"}>{relDays(left)}</Pill> : undefined}
      />
    );
  };
  return (
    <div className="cs-stack">
      <Section title="Upcoming">{upcoming.length ? <Card flush>{upcoming.map(row)}</Card> : <p className="ui-body">Nothing coming up.</p>}</Section>
      {past.length > 0 && <Section title="Past">{<Card flush>{past.map(row)}</Card>}</Section>}
    </div>
  );
}

const DOC_ICON: Record<CaseDocument["kind"], IconName> = { passport: "book", rental_agreement: "home", health_insurance: "shield", university_certificate: "file", photo: "photo", upo: "check", letter: "letter", other: "file" };
const DOC_STATUS = { have: { label: "Have", tone: "ok" }, missing: { label: "Missing", tone: "deadline" }, requested: { label: "Requested", tone: "warn" } } as const;

export function DocumentsTab({ c }: { c: CaseSnapshot }) {
  if (!c.documents.length) return <EmptyState icon="file" title="No documents yet" action={<ButtonLink href="/app/look" size="sm" icon="scan">Add with Look</ButtonLink>}>Snap a letter or document and Dossierly files it here.</EmptyState>;
  const order = { missing: 0, requested: 1, have: 2 } as const;
  const docs = [...c.documents].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  const need = docs.filter((d) => d.status !== "have");
  const have = docs.filter((d) => d.status === "have");
  const photoTask = openPhotoTask(c);
  const row = (d: CaseDocument) => (
    <Row key={d.id} href={isMissingPhoto(d) ? photoCheckHref(photoTask?.id) : `/app/case/documents/${d.id}`} chevron icon={DOC_ICON[d.kind]} title={d.title}
      sub={[d.pages ? `${d.pages} page${d.pages === 1 ? "" : "s"}` : null, Object.keys(d.extractedFields).length ? `${Object.keys(d.extractedFields).length} fields read` : null, d.source === "email" ? "From email" : d.source === "scan" ? "Scanned" : null].filter(Boolean).join(" · ") || undefined}
      end={<Pill tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Pill>} />
  );
  return (
    <div className="cs-stack">
      {need.length > 0 && <Section title="Still needed">{<Card flush>{need.map(row)}</Card>}</Section>}
      <Section title="In your case" action={{ label: "Add", href: "/app/look" }}>{have.length ? <Card flush>{have.map(row)}</Card> : <p className="ui-body">Nothing filed yet.</p>}</Section>
    </div>
  );
}

export function TasksTab({ c }: { c: CaseSnapshot }) {
  const { patchItem } = useCaseData();
  const { toast } = useToast();
  const dl = new Map(c.deadlines.map((d) => [d.id, d]));
  const open = c.tasks.filter((t) => t.status === "open");
  const done = c.tasks.filter((t) => t.status === "done");
  if (!c.tasks.length) return <EmptyState icon="task" title="No tasks">Tasks appear when a letter, a counter session or Dossierly finds something for you to do.</EmptyState>;
  const toggle = async (id: string, to: "open" | "done") => {
    const ok = await patchItem("tasks", id, { status: to });
    if (!ok) toast("Couldn’t save that. Try again.", { tone: "error" });
  };
  const ORIGIN: Record<string, string> = { counter: "From Counter", letter: "From a letter", email: "From email", agent: "From Dossierly", user: "Added by you" };
  const row = (t: CaseSnapshot["tasks"][number]) => {
    const d = t.dueDeadlineId ? dl.get(t.dueDeadlineId) : undefined;
    const left = d ? daysBetween(warsawToday(), d.dueDate) : null;
    return (
      <Row key={t.id} className={t.status === "done" ? "cs-done" : undefined}
        icon={<CheckCircle checked={t.status === "done"} label={t.status === "done" ? `Reopen “${t.title}”` : `Mark “${t.title}” done`} onChange={(v) => void toggle(t.id, v ? "done" : "open")} />}
        title={t.title} sub={[t.detail, d ? `For: ${d.title}` : null, ORIGIN[t.origin]].filter(Boolean).join(" · ")}
        end={<>
          {t.status === "open" && left !== null && <Pill tone={left <= 7 ? "deadline" : "neutral"}>{left < 0 ? "Overdue" : `${left}d`}</Pill>}
          {t.status === "open" && isPhotoTask(t) && <ButtonLink href={photoCheckHref(t.id)} size="sm" variant="primary" icon="camera">Check photo</ButtonLink>}
        </>} />
    );
  };
  return (
    <div className="cs-stack">
      <Section title="Open">{open.length ? <Card flush>{open.map(row)}</Card> : <p className="ui-body">All done. Nice.</p>}</Section>
      {done.length > 0 && <Section title="Done">{<Card flush>{done.map(row)}</Card>}</Section>}
    </div>
  );
}
