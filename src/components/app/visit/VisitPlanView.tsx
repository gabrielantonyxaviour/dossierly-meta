"use client";

import { useState } from "react";
import type { VisitPlan } from "@/lib/visit/types";
import { Icon } from "@/components/Icon";
import { Button, StickyActionBar } from "@/components/ui";
import { announceCaseChange } from "../shell/case-data";

const WHEN = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
const MARK = { have: "✓", missing: "", unknown: "?" } as const;
const STATUS = { have: "In your case", missing: "Not in your case", unknown: "Check yourself" } as const;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function taskId(appt: string, item: string) {
  let h = 0x811c9dc5;
  for (const ch of `${appt}|${item}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `vp_${h.toString(36)}_${item.replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
}

export function VisitPlanView({ plan, onAgain }: { plan: VisitPlan; onAgain(): void }) {
  const [saving, setSaving] = useState<"idle" | "busy" | "done" | "error">("idle");
  const missing = plan.items.filter((i) => i.status === "missing");
  const have = plan.items.filter((i) => i.status === "have").length;

  const addTasks = async () => {
    setSaving("busy");
    const base = plan.appointment?.id ?? "visit";
    const results = await Promise.all(missing.map((i) =>
      fetch("/api/case/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: taskId(base, i.id), title: `Bring: ${i.title.replace(/^bring:?\s*/i, "")}`.slice(0, 200), detail: i.detail.slice(0, 2000), origin: "agent" }) })
        .then((r) => r.ok || r.status === 409).catch(() => false)));
    setSaving(results.every(Boolean) ? "done" : "error");
    if (results.some(Boolean)) announceCaseChange();
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <section className="ui-card vp-hero">
        <span className="tab-label"><Icon name="calendar" size={16} /> {plan.appointment ? "Your appointment" : "Your visit"}</span>
        <h2 style={{ margin: "6px 0 4px" }}>{plan.appointment?.title ?? plan.purpose}</h2>
        {plan.appointment && <p className="muted" style={{ margin: 0 }}>{WHEN.format(new Date(plan.appointment.at))} · {plan.appointment.location}</p>}
        <div className="vp-meter" aria-label={`${have} of ${plan.items.length} already in your case`}>
          <span style={{ width: `${plan.items.length ? (have / plan.items.length) * 100 : 0}%` }} />
        </div>
        <p className="small" style={{ margin: "8px 0 0" }}><b>{have} of {plan.items.length}</b> already in your case · {plan.searches} official searches · {(plan.ms / 1000).toFixed(0)} s</p>
      </section>
      <ul className="checklist">
        {plan.items.map((i) => (
          <li key={i.id} className={`check-item ${i.status === "have" ? "ci-have" : i.status === "missing" ? "ci-missing" : "ci-check"}`}>
            <span className="ci-mark" aria-hidden="true">{MARK[i.status]}</span>
            <div>
              <div className="row between" style={{ gap: 6 }}><b>{i.title}</b><span className="ci-status">{STATUS[i.status]}</span></div>
              {i.detail && <p className="small muted" style={{ margin: "4px 0 0" }}>{i.detail}</p>}
              {i.source && <a className="cite" href={i.source.url} target="_blank" rel="noreferrer"><Icon name="link" size={13} /> {host(i.source.url)}</a>}
            </div>
          </li>
        ))}
      </ul>
      {saving === "error" && <p className="small" role="alert">Some tasks could not be added. Try again.</p>}
      {plan.office && (
        <section className="ui-card vp-office">
          <span className="tab-label">Where</span>
          <b>{plan.office.name}</b>
          {plan.office.address && <span>{plan.office.address}</span>}
          {plan.office.note && <p className="small muted" style={{ margin: "6px 0 0" }}>{plan.office.note}</p>}
          {plan.office.address && <a className="cite" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.office.address)}`} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Open in Maps</a>}
        </section>
      )}
      {plan.warnings.length > 0 && (
        <div className="notice notice-calm small"><ul style={{ margin: 0 }}>{plan.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul></div>
      )}
      <section>
        <span className="tab-label">Sources</span>
        <ol className="vp-sources">
          {plan.citations.map((c) => (
            <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">{c.title || host(c.url)}</a> <span className={`ui-pill ${c.official ? "ui-pill--ok" : "ui-pill--warn"}`}>{c.official ? "Official" : "Unofficial"}</span><small>{host(c.url)}</small></li>
          ))}
        </ol>
      </section>
      <p className="tiny muted">Searched live with Muse Spark&apos;s web search. Office rules change; if a page and this list disagree, the page wins.</p>
      <StickyActionBar secondary={missing.length > 0 ? <Button variant="ghost" onClick={onAgain}>Plan another visit</Button> : undefined}>
        {missing.length > 0 ? (
          <Button variant="primary" icon={saving === "done" ? "check" : undefined} loading={saving === "busy"} onClick={() => void addTasks()} disabled={saving === "busy" || saving === "done"}>
            {saving === "done" ? "Added to your tasks" : `Add ${missing.length} missing item${missing.length === 1 ? "" : "s"} to my tasks`}
          </Button>
        ) : (
          <Button variant="primary" onClick={onAgain}>Plan another visit</Button>
        )}
      </StickyActionBar>
    </div>
  );
}
