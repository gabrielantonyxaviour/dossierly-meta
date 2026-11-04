"use client";
import type { CaseSnapshot } from "@/lib/case/types";
import { Button, Card, CheckCircle, Row, Section, Sheet } from "@/components/ui";
import type { IconName } from "@/components/Icon";
import { dayLabel } from "../format";
import type { Attachment } from "./useAgentChat";

export function findAttachment(c: CaseSnapshot, kind: string, id: string): Attachment | null {
  const pick = (title: string | undefined, k: Attachment["kind"]) => (title ? { kind: k, id, title } : null);
  if (kind === "deadline") return pick(c.deadlines.find((x) => x.id === id)?.title, "deadline");
  if (kind === "document") return pick(c.documents.find((x) => x.id === id)?.title, "document");
  if (kind === "task") return pick(c.tasks.find((x) => x.id === id)?.title, "task");
  if (kind === "appointment") return pick(c.appointments.find((x) => x.id === id)?.title, "appointment");
  if (kind === "event") return pick(c.events.find((x) => x.id === id)?.summary.slice(0, 80), "event");
  return null;
}

/** Pick case items to give the agent full detail on (max 5). */
export function AttachSheet({ open, onClose, c, selected, onToggle }: { open: boolean; onClose: () => void; c: CaseSnapshot; selected: Attachment[]; onToggle: (a: Attachment) => void }) {
  const on = (id: string) => selected.some((s) => s.id === id);
  const group = (title: string, icon: IconName, items: { a: Attachment; sub: string }[]) =>
    items.length ? (
      <Section title={title}>
        <Card flush>
          {items.map(({ a, sub }) => (
            <Row key={a.id} icon={icon} title={a.title} sub={sub} onClick={() => onToggle(a)}
              end={<CheckCircle checked={on(a.id)} label={`Attach ${a.title}`} onChange={() => onToggle(a)} />} />
          ))}
        </Card>
      </Section>
    ) : null;
  return (
    <Sheet open={open} onClose={onClose} title="Attach from your case" footer={<Button variant="primary" onClick={onClose}>{selected.length ? `Attach ${selected.length}` : "Done"}</Button>}>
      <div style={{ display: "grid", gap: 20 }}>
        {group("Deadlines", "clock", c.deadlines.filter((d) => d.status === "open").map((d) => ({ a: { kind: "deadline", id: d.id, title: d.title }, sub: `Due ${dayLabel(d.dueDate)}` })))}
        {group("Documents", "file", c.documents.map((d) => ({ a: { kind: "document", id: d.id, title: d.title }, sub: d.status === "have" ? "In your case" : d.status === "requested" ? "Requested" : "Missing" })))}
        {group("Appointments", "calendar", c.appointments.map((x) => ({ a: { kind: "appointment", id: x.id, title: x.title }, sub: x.location.name })))}
        {group("Tasks", "task", c.tasks.filter((t) => t.status === "open").map((t) => ({ a: { kind: "task", id: t.id, title: t.title }, sub: t.detail || "Open task" })))}
      </div>
    </Sheet>
  );
}
