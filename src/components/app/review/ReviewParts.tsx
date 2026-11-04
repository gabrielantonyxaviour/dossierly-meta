"use client";
import Link from "next/link";
import { useState } from "react";
import type { CaseSnapshot, CaseTask } from "@/lib/case/types";
import { Button, Pill, useToast, type Tone } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { announceCaseChange, useCaseData } from "../shell/case-data";
import { ACTOR_LABEL, evidenceRef, parseProposal, SEV_LABEL, type Inconsistency, type PlanStep, type Risk, type Severity } from "./derive";

const dayShort = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const SEV_TONE: Record<Severity, Tone> = { critical: "deadline", high: "deadline", medium: "warn", low: "neutral" };

function Evidence({ c, ids }: { c: CaseSnapshot; ids: string[] }) {
  const refs = ids.map((id) => evidenceRef(c, id)).filter((r): r is NonNullable<typeof r> => !!r).slice(0, 4);
  if (!refs.length) return null;
  return (
    <div className="rv-evidence" aria-label="Evidence">
      {refs.map((r, i) => r.href
        ? <Link key={i} href={r.href} className="rv-chip"><Icon name="file" size={14} />{r.label}</Link>
        : <span key={i} className="rv-chip"><Icon name="file" size={14} />{r.label}</span>)}
    </div>
  );
}

export function RiskCard({ r, c }: { r: Risk; c: CaseSnapshot }) {
  return (
    <article className={`rv-card rv-risk rv-risk--${r.severity}`}>
      <div className="rv-card-top"><Pill tone={SEV_TONE[r.severity]} dot>{SEV_LABEL[r.severity]}</Pill>{r.deadlineDate && <span className="rv-date">Affects {dayShort(r.deadlineDate)}</span>}</div>
      <h3>{r.what}</h3>
      {r.why && <p>{r.why}</p>}
      {r.deadlineImpact && <p className="rv-impact">{r.deadlineImpact}</p>}
      <Evidence c={c} ids={r.evidence} />
    </article>
  );
}

export function InconsistencyCard({ x, c }: { x: Inconsistency; c: CaseSnapshot }) {
  return (
    <article className="rv-card rv-incon">
      <h3>{x.what}</h3>
      {x.detail && <p>{x.detail}</p>}
      {x.legalConsequence && <p className="rv-law"><Icon name="scale" size={18} /><span>{x.legalConsequence}</span></p>}
      {x.suggestedFix && <p className="rv-fix"><b>Fix</b>{x.suggestedFix}</p>}
      <Evidence c={c} ids={x.evidence} />
    </article>
  );
}

export function Plan({ steps }: { steps: PlanStep[] }) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return (
    <ol className="rv-plan">
      {sorted.map((s) => (
        <li key={s.order}>
          <span className="rv-plan-when">{s.date ? dayShort(s.date) : "When ready"}</span>
          <div className="rv-plan-main">
            <p>{s.action}</p>
            <span className="rv-plan-meta">
              <Pill tone={s.actor === "user" ? "agent" : "outline"}>{ACTOR_LABEL[s.actor]}</Pill>
              {s.legalBasis && <span>{s.legalBasis}</span>}
              {s.dependsOn.length > 0 && <span>After step {s.dependsOn.join(", ")}</span>}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

async function post(path: string, body: unknown): Promise<{ id: string } | null> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return res?.ok ? ((await res.json()) as { id: string }) : null;
}

/** A proposal from the review: accept turns it into a real task (and a deadline when it proposes a date); dismiss hides it. */
export function ProposalCard({ t }: { t: CaseTask }) {
  const { patchItem, refresh } = useCaseData();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"accept" | "dismiss" | null>(null);
  const p = parseProposal(t);
  const accept = async () => {
    setBusy("accept");
    let dueDeadlineId = t.dueDeadlineId;
    if (p.dueDate) {
      const d = await post("/api/case/deadlines", { title: p.title, dueDate: p.dueDate, computation: { steps: ["Proposed by the case review; you accepted the date."], rule: null, legalRefUrl: null } });
      if (!d) { setBusy(null); return toast("Couldn’t add the deadline. Try again.", { tone: "error" }); }
      dueDeadlineId = d.id;
    }
    const ok = await patchItem("tasks", t.id, { title: p.title, detail: p.detail, dueDeadlineId });
    setBusy(null);
    if (!ok) return toast("Couldn’t save that. Try again.", { tone: "error" });
    toast(p.dueDate ? `Added: ${p.title}, due ${dayShort(p.dueDate)}` : `Added to your tasks: ${p.title}`, { tone: "ok" });
    announceCaseChange();
    void refresh();
  };
  const dismiss = async () => {
    setBusy("dismiss");
    const ok = await patchItem("tasks", t.id, { status: "dismissed" });
    setBusy(null);
    if (!ok) toast("Couldn’t save that. Try again.", { tone: "error" });
  };
  return (
    <article className="rv-card rv-prop">
      <div className="rv-card-top"><Pill tone="agent" icon="sparkle">Proposed</Pill>{p.dueDate && <span className="rv-date">Due {dayShort(p.dueDate)}</span>}</div>
      <h3>{p.title}</h3>
      {p.detail && <p>{p.detail}</p>}
      <div className="rv-prop-actions">
        <Button variant="primary" icon="check" loading={busy === "accept"} disabled={!!busy} onClick={() => void accept()}>Accept</Button>
        <Button variant="ghost" loading={busy === "dismiss"} disabled={!!busy} onClick={() => void dismiss()}>Dismiss</Button>
      </div>
    </article>
  );
}
