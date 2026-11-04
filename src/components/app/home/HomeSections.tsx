"use client";
import Link from "next/link";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import type { CaseSnapshot } from "@/lib/case/types";
import { ButtonLink, Card, CheckCircle, Pill, Row, Section, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/Icon";
import { ago, dateParts, relDays, timeLabel } from "../format";
import { eventTitle } from "../notifications/derive";
import { useCaseData } from "../shell/case-data";
import { isPhotoTask, photoCheckHref } from "../photo-link";

const ACTIONS: { href: string; icon: IconName; title: string; sub: string }[] = [
  { href: "/app/look", icon: "scan", title: "Look", sub: "Photo of a letter or screen" },
  { href: "/app/counter", icon: "counter", title: "Counter", sub: "Live help at the office" },
  { href: "/app/rehearse", icon: "mic", title: "Rehearse", sub: "Practise your appointment" },
  { href: "/app/call", icon: "phone", title: "Talk", sub: "Voice call with Dossierly" },
];

export function QuickActions() {
  return (
    <nav className="hm-actions" aria-label="Quick actions">
      {ACTIONS.map((a) => (
        <Link key={a.href} href={a.href} className="hm-action">
          <span className="hm-action-icon"><Icon name={a.icon} size={22} /></span>
          <b>{a.title}</b>
          <small>{a.sub}</small>
        </Link>
      ))}
    </nav>
  );
}

export function UpcomingAppointment({ c }: { c: CaseSnapshot }) {
  const today = warsawToday();
  const a = [...c.appointments].filter((x) => warsawDate(x.at) >= today).sort((x, y) => x.at.localeCompare(y.at))[0];
  if (!a) return null;
  const p = dateParts(a.at);
  const left = daysBetween(today, warsawDate(a.at));
  const prep = c.tasks.filter((t) => a.prepTaskIds.includes(t.id) && t.status === "open").length;
  return (
    <Section title="Coming up" action={{ label: "All dates", href: "/app/case?tab=dates" }}>
      <Card className="hm-appt">
        <div className="hm-date-tile" aria-hidden="true"><small>{p.month}</small><b>{p.day}</b><small>{p.dow}</small></div>
        <div className="hm-appt-main">
          <Pill tone="official">{relDays(left)} · {timeLabel(a.at)}</Pill>
          <h3 className="ui-title">{a.title}</h3>
          <p className="ui-meta"><Icon name="pin" size={14} /> {a.location.name}{a.location.address ? `, ${a.location.address}` : ""}</p>
          {a.purpose && <p className="ui-body">{a.purpose}</p>}
          {prep > 0 && <p className="ui-meta">{prep} thing{prep === 1 ? "" : "s"} to prepare</p>}
        </div>
      </Card>
    </Section>
  );
}

export function OpenTasks({ c }: { c: CaseSnapshot }) {
  const { patchItem } = useCaseData();
  const { toast } = useToast();
  const open = c.tasks.filter((t) => t.status === "open").slice(0, 4);
  if (!open.length) return null;
  const done = async (id: string, title: string) => {
    const ok = await patchItem("tasks", id, { status: "done" });
    toast(ok ? `Done: ${title}` : "Couldn’t save that. Try again.", { tone: ok ? "ok" : "error", action: ok ? { label: "Undo", onClick: () => void patchItem("tasks", id, { status: "open" }) } : undefined });
  };
  const dl = new Map(c.deadlines.map((d) => [d.id, d]));
  return (
    <Section title="To do" action={{ label: "All tasks", href: "/app/case?tab=tasks" }}>
      <Card flush>
        {open.map((t) => {
          const d = t.dueDeadlineId ? dl.get(t.dueDeadlineId) : undefined;
          const left = d ? daysBetween(warsawToday(), d.dueDate) : null;
          return (
            <Row key={t.id} icon={<CheckCircle checked={false} label={`Mark “${t.title}” done`} onChange={() => void done(t.id, t.title)} />} title={t.title}
              sub={d ? `For: ${d.title}` : t.detail || undefined}
              end={<>
                {left !== null && <Pill tone={left <= 7 ? "deadline" : "neutral"}>{left < 0 ? "Overdue" : `${left}d`}</Pill>}
                {isPhotoTask(t) && <ButtonLink href={photoCheckHref(t.id)} size="sm" variant="primary" icon="camera">Check photo</ButtonLink>}
              </>} />
          );
        })}
      </Card>
    </Section>
  );
}

const EV_ICON: Record<string, IconName> = { email_received: "mail", letter_read: "letter", call: "phone", counter_session: "counter", deadline_created: "clock", document_added: "file", note: "info" };
export const eventIcon = (t: string): IconName => EV_ICON[t] ?? "info";

export function RecentActivity({ c }: { c: CaseSnapshot }) {
  const items = c.events.slice(0, 4);
  if (!items.length) return null;
  return (
    <Section title="Recent activity" action={{ label: "Timeline", href: "/app/case?tab=timeline" }}>
      <Card flush>
        {items.map((e) => (
          <Row key={e.id} icon={eventIcon(e.type)} iconBg={e.type === "call" ? "var(--agent-soft)" : undefined} iconColor={e.type === "call" ? "var(--agent-a)" : undefined}
            title={eventTitle(e.type)} sub={e.summary} end={<span className="ui-num">{ago(e.at)}</span>} href={`/app/case?tab=timeline#${e.id}`} />
        ))}
      </Card>
    </Section>
  );
}
