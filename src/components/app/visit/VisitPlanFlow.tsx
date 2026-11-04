"use client";

import { useEffect, useRef, useState } from "react";
import type { Appointment } from "@/lib/case/types";
import type { VisitEvent, VisitPlan } from "@/lib/visit/types";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/ui";
import { errorText, readNdjson } from "../look/ndjson";
import { VisitPlanView } from "./VisitPlanView";
import "../look/look.css";
import "./visit.css";

const WHEN = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" });
type Stage = "idle" | "searching" | "comparing" | "done" | "error";

export function VisitPlanFlow() {
  const [appts, setAppts] = useState<Appointment[] | null>(null);
  const [pick, setPick] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [plan, setPlan] = useState<VisitPlan | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const t0 = useRef(0);

  useEffect(() => {
    fetch("/api/case/appointments").then((r) => (r.ok ? r.json() : [])).then((list: Appointment[]) => {
      const upcoming = list.filter((a) => Date.parse(a.at) > Date.now() - 86_400_000);
      setAppts(upcoming);
      if (upcoming[0]) setPick(upcoming[0].id);
    }).catch(() => setAppts([]));
  }, []);

  useEffect(() => {
    if (stage !== "searching" && stage !== "comparing") return;
    const id = setInterval(() => setElapsed(Math.round((Date.now() - t0.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [stage]);

  const build = async () => {
    setStage("searching"); setPlan(null); setError(null); setElapsed(0); t0.current = Date.now();
    try {
      const body = pick ? { appointmentId: pick } : { purpose: purpose.trim() };
      const res = await fetch("/api/visit-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const e = await errorText(res); setError({ message: e.message, retryable: res.status !== 400 }); setStage("error"); return; }
      let ended = false;
      await readNdjson<VisitEvent>(res, (e) => {
        if (e.type === "stage") setStage(e.stage);
        else if (e.type === "plan") { ended = true; setPlan(e.plan); setStage("done"); }
        else if (e.type === "error") { ended = true; setError({ message: e.error, retryable: e.retryable }); setStage("error"); }
      });
      if (!ended) { setError({ message: "The connection closed before the plan was ready. Try again.", retryable: true }); setStage("error"); }
    } catch {
      setError({ message: "We lost the connection. Check your network and try again.", retryable: true });
      setStage("error");
    }
  };

  const busy = stage === "searching" || stage === "comparing";
  const canBuild = !!pick || purpose.trim().length > 2;
  return (
    <div className="sh-page lk-page vp-page">
      <TopBar title="Visit plan" back={{ href: "/app/look", label: "Look" }} sub="Before an appointment I search the official pages live, build what to bring, and check it against what's already in your case. Every line links to its source." />
      {!plan && (
        <section className="ui-card stack" style={{ ["--gap" as string]: "14px" }}>
          {appts === null && <div className="skeleton" style={{ height: 56 }} />}
          {appts && appts.length > 0 && (
            <fieldset className="lk-via">
              <legend className="label">Which appointment?</legend>
              <div className="vp-appts">
                {appts.map((a) => (
                  <label key={a.id} className={`vp-appt${pick === a.id ? " is-on" : ""}`}>
                    <input type="radio" name="appt" checked={pick === a.id} onChange={() => setPick(a.id)} />
                    <Icon name="calendar" size={20} />
                    <span className="grow"><b>{a.title}</b><small>{WHEN.format(new Date(a.at))} · {a.location.name}</small></span>
                  </label>
                ))}
                <label className={`vp-appt${pick === "" ? " is-on" : ""}`}>
                  <input type="radio" name="appt" checked={pick === ""} onChange={() => setPick("")} />
                  <Icon name="help" size={20} /><span className="grow"><b>Something else</b></span>
                </label>
              </div>
            </fieldset>
          )}
          {(pick === "" || appts?.length === 0) && (
            <label className="ui-field">
              <span>What is the visit for?</span>
              <input className="ui-input" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} placeholder="Collecting my residence card in Warsaw" />
            </label>
          )}
          <button type="button" className="ui-btn ui-btn--primary ui-btn--block" disabled={!canBuild || busy} onClick={() => void build()}>
            {busy ? <><span className="spinner" aria-hidden="true" /> Building your plan…</> : <><Icon name="globe" size={18} /> Build my checklist</>}
          </button>
          {busy && (
            <ol className="lk-progress" aria-live="polite">
              <li className={`lk-prog is-${stage === "searching" ? "run" : "ok"}`}><span className="lk-prog-dot">{stage !== "searching" && <Icon name="check" size={13} />}</span><span className="grow">Searching official pages (gov.pl, the Mazowiecki office, MOS)</span><span className="lk-model">Muse Spark · web search{stage === "searching" ? ` · ${elapsed} s` : ""}</span></li>
              <li className={`lk-prog is-${stage === "comparing" ? "run" : "wait"}`}><span className="lk-prog-dot" /><span className="grow">Comparing with the documents in your case</span><span className="lk-model">{stage === "comparing" ? `${elapsed} s` : ""}</span></li>
            </ol>
          )}
          {busy && elapsed > 20 && <p className="tiny muted" style={{ margin: 0 }}>Reading several official pages usually takes about a minute.</p>}
          {error && <div className="ui-inline-error small" role="alert">{error.message} {error.retryable && <button type="button" className="ui-btn ui-btn--sm" onClick={() => void build()}>Try again</button>}</div>}
        </section>
      )}
      {plan && <VisitPlanView plan={plan} onAgain={() => { setPlan(null); setStage("idle"); }} />}
    </div>
  );
}
