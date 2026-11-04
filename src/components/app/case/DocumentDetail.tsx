"use client";
import { ButtonLink, Card, EmptyState, Pill, Row, Section, Skeleton, StickyActionBar, TopBar } from "@/components/ui";
import { dayLabel } from "../format";
import { useCaseData } from "../shell/case-data";
import "./case.css";

const STATUS = { have: ["Have", "ok"], missing: ["Missing", "deadline"], requested: ["Requested", "warn"] } as const;
const SOURCE: Record<string, string> = { upload: "Uploaded by you", email: "Found in your email", scan: "Scanned with Look", user: "Added by you", agent: "Added by Dossierly" };
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");

/** A document, full screen: status, what was read from it, deadlines it started, and next actions. */
export function DocumentDetail({ id }: { id: string }) {
  const { snapshot, status } = useCaseData();
  const back = { href: "/app/case?tab=documents", label: "Back to documents" };
  if (status === "loading") return <div className="sh-page"><TopBar title="Document" back={back} large={false} /><Skeleton h={240} r={22} /></div>;
  const d = snapshot?.documents.find((x) => x.id === id);
  if (!snapshot || !d) return <div className="sh-page"><TopBar title="Document" back={back} large={false} /><EmptyState icon="file" title="Document not found" action={<ButtonLink href="/app/case?tab=documents" size="sm">All documents</ButtonLink>}>It may have been removed.</EmptyState></div>;
  const fields = Object.entries(d.extractedFields);
  const deadlines = snapshot.deadlines.filter((x) => x.triggeredBy === d.id);
  const events = snapshot.events.filter((e) => e.refs.includes(d.id));
  const [st, tone] = STATUS[d.status];
  const q = encodeURIComponent(d.status === "have" ? `What does “${d.title}” mean for my case?` : `How do I get “${d.title}” and what exactly does the office need?`);
  const ask = <ButtonLink href={`/app/chat?q=${q}&attach=document:${d.id}`} variant={d.status === "have" ? "primary" : "ghost"} icon="sparkle">Ask about this document</ButtonLink>;
  return (
    <div className={`sh-page ${d.status !== "have" || d.kind === "letter" ? "sh-page--actions2" : "sh-page--actions"}`}>
      <TopBar title={d.title} back={back} eyebrow={SOURCE[d.source]} actions={<Pill tone={tone} dot>{st}</Pill>} />
      {d.status !== "have" ? (
        <Card className="dt-hero">
          <p className="ui-title">{d.status === "requested" ? "The office asked for this" : "This is still missing"}</p>
          <p className="ui-body">{d.status === "requested" ? "Get it before the deadline below, then add a photo with Look so it’s in your case." : "Add it with Look when you have it. Dossierly checks it against what the office needs."}</p>
        </Card>
      ) : (
        <div className="dt-preview" aria-label="Document file">
          <EmptyState icon={d.kind === "photo" ? "photo" : "file"} title={d.fileKey ? "Stored in your case" : "No file attached"}>
            {d.pages ? `${d.pages} page${d.pages === 1 ? "" : "s"} · ` : ""}Added {dayLabel(d.createdAt.slice(0, 10))}
          </EmptyState>
        </div>
      )}

      {fields.length > 0 && (
        <Section title="What Dossierly read">
          <Card flush><dl className="dt-fields">{fields.map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{v}</dd></div>)}</dl></Card>
        </Section>
      )}

      {deadlines.length > 0 && (
        <Section title="Deadlines it started">
          <Card flush>{deadlines.map((x) => <Row key={x.id} href={`/app/case/deadlines/${x.id}`} chevron icon="clock" iconBg="var(--deadline-soft)" iconColor="var(--deadline)" title={x.title} sub={`Due ${dayLabel(x.dueDate)}${x.computation.rule ? ` · ${x.computation.rule}` : ""}`} />)}</Card>
        </Section>
      )}

      {events.length > 0 && (
        <Section title="History">
          <Card flush>{events.map((e) => <Row key={e.id} icon="clock" title={e.summary} sub={dayLabel(e.at.slice(0, 10))} href={`/app/case?tab=timeline#${e.id}`} />)}</Card>
        </Section>
      )}

      {d.status !== "have" ? (
        <StickyActionBar secondary={ask}><ButtonLink href="/app/look" variant="primary" icon="scan">Add with Look</ButtonLink></StickyActionBar>
      ) : (
        <StickyActionBar secondary={d.kind === "letter" ? <ButtonLink href="/app/look" variant="ghost" icon="scan">Look at it again</ButtonLink> : undefined}>{ask}</StickyActionBar>
      )}
    </div>
  );
}
