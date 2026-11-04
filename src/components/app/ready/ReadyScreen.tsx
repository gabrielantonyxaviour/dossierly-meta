"use client";
import Link from "next/link";
import { daysBetween, warsawDate, warsawToday } from "@/lib/case/next-step";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Pill, Row, Section, Skeleton, TopBar, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ago, timeLabel } from "../format";
import { useCaseData } from "../shell/case-data";
import { shortTitle } from "../case/KeyCards";
import { CHANNEL_LABEL, LANG_LABEL, latestReady, type Draft } from "./derive";
import "./ready.css";

const dayShort = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const relDay = (iso: string, today: string) => {
  const n = daysBetween(today, warsawDate(iso));
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : dayShort(warsawDate(iso));
};

function DraftCard({ d }: { d: Draft }) {
  const { toast } = useToast();
  const lang = LANG_LABEL[d.language] ?? d.language.toUpperCase();
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.text); toast("Draft copied", { tone: "ok" }); } catch { toast("Couldn’t copy", { tone: "error" }); }
  };
  const q = encodeURIComponent(`Walk me through this draft: “${d.doc.title}”. What does it say and is anything missing?`);
  return (
    <article className="rd-draft">
      <header className="rd-draft-head">
        <h3>{d.doc.title.replace(/\s*\(draft\)\s*$/i, "")}</h3>
        <Pill tone="agent">{lang ? `${lang} draft` : "Draft"}</Pill>
      </header>
      {d.to && <p className="rd-to"><span>To</span>{d.to}</p>}
      {d.subject && <p className="rd-subject">{d.subject}</p>}
      <div className="rd-paper" lang={d.language || undefined}>{d.text}</div>
      <footer className="rd-draft-foot">
        <Button size="sm" icon="copy" onClick={() => void copy()}>Copy</Button>
        <ButtonLink size="sm" variant="ghost" icon="sparkle" href={`/app/chat?q=${q}&attach=document:${d.doc.id}`}>Ask about it</ButtonLink>
      </footer>
    </article>
  );
}

/** Film A8: everything the agent prepared after a new letter, in one slow-scrollable view. */
export function ReadyScreen() {
  const { status, snapshot, error, refresh } = useCaseData();
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="60%" /><Skeleton h={140} r={20} /><Skeleton h={320} r={20} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? "Your case didn’t load."} onRetry={() => void refresh()} /></div>;
  const b = latestReady(snapshot);
  const back = { href: "/app", label: "Home" };
  if (!b) {
    return (
      <div className="sh-page">
        <TopBar title="Ready for you" back={back} />
        <EmptyState icon="sparkle" title="Nothing waiting" action={<ButtonLink href="/app" size="sm">Back to Home</ButtonLink>}>
          When a new letter arrives, Dossierly reads it, counts the date and drafts what you need. It shows up here.
        </EmptyState>
      </div>
    );
  }
  const today = warsawToday();
  const d = b.deadline;
  const left = d ? daysBetween(today, d.dueDate) : 0;
  return (
    <div className="sh-page rd">
      <TopBar
        title="Ready for you"
        back={back}
        eyebrow={`New letter · ${relDay(b.arrivedAt, today).toLowerCase() === "today" ? `today ${timeLabel(b.arrivedAt)}` : ago(b.arrivedAt)}`}
        sub="A letter came in. Dossierly read it, counted the date and drafted what you need. Check them, then send."
      />

      {(d || b.reminder) && (
        <div className="rd-top">
          {d && (
            <Link href={`/app/case/deadlines/${d.id}`} className={`rd-due${left <= 7 ? " is-urgent" : ""}`}>
              <span className="rd-k"><Icon name="clock" size={18} />{shortTitle(d.title)}</span>
              <span className="rd-big">Due {dayShort(d.dueDate)}</span>
              <span className="rd-sub">{left < 0 ? `${-left} days overdue` : left === 0 ? "Due today" : `${left} day${left === 1 ? "" : "s"} left`}{d.computation.rule ? ` · ${d.computation.rule}` : ""}</span>
            </Link>
          )}
          {b.reminder && (
            <div className="rd-remind">
              <span className="rd-k"><Icon name="bell" size={18} />Reminder</span>
              <span className="rd-big rd-big--sm">{relDay(b.reminder.at, today)} {timeLabel(b.reminder.at)}</span>
              <span className="rd-sub">{CHANNEL_LABEL[b.reminder.channel] ?? "Reminder set"}</span>
            </div>
          )}
        </div>
      )}

      {b.drafts.length > 0 && (
        <section className="rd-drafts" aria-label="Drafts to check">
          <h2 className="rd-h">Drafts to check <span>{b.drafts.length}</span></h2>
          {b.drafts.map((x) => <DraftCard key={x.doc.id} d={x} />)}
        </section>
      )}

      <Section title="What happened">
        <Card flush>
          <Row href={`/app/case/documents/${b.letter.id}`} chevron icon="letter" iconBg="var(--official-soft)" iconColor="var(--official)" title={b.letter.title} sub={`Arrived ${relDay(b.arrivedAt, today).toLowerCase()} ${timeLabel(b.arrivedAt)}${b.letter.extractedFields.asks ? ` · ${b.letter.extractedFields.asks}` : ""}`} />
          {b.call && <Row icon="phone" iconBg="var(--agent-soft)" iconColor="var(--agent-ink)" title={`Dossierly called you · ${timeLabel(b.call.at)}`} sub={b.call.summary} />}
        </Card>
      </Section>
      <p className="ui-meta">Drafts only. Dossierly never sends, signs or files anything for you.</p>
    </div>
  );
}
