"use client";

import { useState } from "react";
import type { VisitPlan } from "@/lib/visit/types";
import { Icon } from "@/components/Icon";
import { Button, StickyActionBar } from "@/components/ui";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { announceCaseChange } from "../shell/case-data";

const when = (tag: string, iso: string) => new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(iso));
const MARK = { have: "✓", missing: "", unknown: "?" } as const;
const STATUS = { have: "statusHave", missing: "statusMissing", unknown: "statusUnknown" } as const;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function taskId(appt: string, item: string) {
  let h = 0x811c9dc5;
  for (const ch of `${appt}|${item}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `vp_${h.toString(36)}_${item.replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
}

export function VisitPlanView({ plan, onAgain }: { plan: VisitPlan; onAgain(): void }) {
  const t = useT("visit");
  const tag = LOCALE_TAGS[useLocale()];
  const [saving, setSaving] = useState<"idle" | "busy" | "done" | "error">("idle");
  const missing = plan.items.filter((i) => i.status === "missing");
  const have = plan.items.filter((i) => i.status === "have").length;

  const addTasks = async () => {
    setSaving("busy");
    const base = plan.appointment?.id ?? "visit";
    const results = await Promise.all(missing.map((i) =>
      fetch("/api/case/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: taskId(base, i.id), title: t("bringTask", { item: i.title.replace(/^bring:?\s*/i, "") }).slice(0, 200), detail: i.detail.slice(0, 2000), origin: "agent" }) })
        .then((r) => r.ok || r.status === 409).catch(() => false)));
    setSaving(results.every(Boolean) ? "done" : "error");
    if (results.some(Boolean)) announceCaseChange();
  };

  return (
    <div className="stack" style={{ ["--gap" as string]: "16px" }}>
      <section className="ui-card vp-hero">
        <span className="tab-label"><Icon name="calendar" size={16} /> {plan.appointment ? t("yourAppt") : t("yourVisit")}</span>
        <h2 style={{ margin: "6px 0 4px" }}>{plan.appointment?.title ?? plan.purpose}</h2>
        {plan.appointment && <p className="muted" style={{ margin: 0 }}>{when(tag, plan.appointment.at)} · {plan.appointment.location}</p>}
        <div className="vp-meter" aria-label={t("meterAria", { have, total: plan.items.length })}>
          <span style={{ width: `${plan.items.length ? (have / plan.items.length) * 100 : 0}%` }} />
        </div>
        <p className="small" style={{ margin: "8px 0 0" }}>{rich(t("summary", { searches: plan.searches, secs: (plan.ms / 1000).toFixed(0) }), { count: <b>{t("countOf", { have, total: plan.items.length })}</b> })}</p>
      </section>
      <ul className="checklist">
        {plan.items.map((i) => (
          <li key={i.id} className={`check-item ${i.status === "have" ? "ci-have" : i.status === "missing" ? "ci-missing" : "ci-check"}`}>
            <span className="ci-mark" aria-hidden="true">{MARK[i.status]}</span>
            <div>
              <div className="row between" style={{ gap: 6 }}><b>{i.title}</b><span className="ci-status">{t(STATUS[i.status])}</span></div>
              {i.detail && <p className="small muted" style={{ margin: "4px 0 0" }}>{i.detail}</p>}
              {i.source && <a className="cite" href={i.source.url} target="_blank" rel="noreferrer"><Icon name="link" size={13} /> {host(i.source.url)}</a>}
            </div>
          </li>
        ))}
      </ul>
      {saving === "error" && <p className="small" role="alert">{t("addError")}</p>}
      {plan.office && (
        <section className="ui-card vp-office">
          <span className="tab-label">{t("where")}</span>
          <b>{plan.office.name}</b>
          {plan.office.address && <span>{plan.office.address}</span>}
          {plan.office.note && <p className="small muted" style={{ margin: "6px 0 0" }}>{plan.office.note}</p>}
          {plan.office.address && <a className="cite" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(plan.office.address)}`} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> {t("openMaps")}</a>}
        </section>
      )}
      {plan.warnings.length > 0 && (
        <div className="notice notice-calm small"><ul style={{ margin: 0 }}>{plan.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul></div>
      )}
      <section>
        <span className="tab-label">{t("sources")}</span>
        <ol className="vp-sources">
          {plan.citations.map((c) => (
            <li key={c.url}><a href={c.url} target="_blank" rel="noreferrer">{c.title || host(c.url)}</a> <span className={`ui-pill ${c.official ? "ui-pill--ok" : "ui-pill--warn"}`}>{c.official ? t("official") : t("unofficial")}</span><small>{host(c.url)}</small></li>
          ))}
        </ol>
      </section>
      <p className="tiny muted">{t("footnote")}</p>
      <StickyActionBar secondary={missing.length > 0 ? <Button variant="ghost" onClick={onAgain}>{t("planAnother")}</Button> : undefined}>
        {missing.length > 0 ? (
          <Button variant="primary" icon={saving === "done" ? "check" : undefined} loading={saving === "busy"} onClick={() => void addTasks()} disabled={saving === "busy" || saving === "done"}>
            {saving === "done" ? t("added") : missing.length === 1 ? t("addOne") : t("addMany", { n: missing.length })}
          </Button>
        ) : (
          <Button variant="primary" onClick={onAgain}>{t("planAnother")}</Button>
        )}
      </StickyActionBar>
    </div>
  );
}
