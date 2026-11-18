"use client";

import { useEffect, useRef, useState } from "react";
import type { Appointment } from "@/lib/case/types";
import type { VisitEvent, VisitPlan } from "@/lib/visit/types";
import { Icon } from "@/components/Icon";
import { Button, InlineError, MobileFlowHeader, MobilePage, OptionList, ScreenTitle, Skeleton, StickyActionBar } from "@/components/ui";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { errorText, readNdjson } from "../look/ndjson";
import { VisitPlanView } from "./VisitPlanView";
import "../look/look.css";
import "./visit.css";

const when = (tag: string, iso: string) => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(iso));
type Stage = "idle" | "searching" | "comparing" | "done" | "error";

export function VisitPlanFlow() {
  const t = useT("visit");
  const tag = LOCALE_TAGS[useLocale()];
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
      if (!ended) { setError({ message: t("closedEarly"), retryable: true }); setStage("error"); }
    } catch {
      setError({ message: t("lostConnection"), retryable: true });
      setStage("error");
    }
  };

  const busy = stage === "searching" || stage === "comparing";
  const canBuild = !!pick || purpose.trim().length > 2;
  const options = [
    ...(appts ?? []).map((a) => ({ value: a.id, label: a.title, sub: `${when(tag, a.at)} · ${a.location.name}`, icon: "calendar" as const })),
    { value: "", label: t("somethingElse"), icon: "help" as const },
  ];
  return (
    <>
      <MobileFlowHeader back="/app/look" backLabel={t("backToLook")} title={t("title")} />
      <MobilePage actions={plan ? "double" : true} className="lk-page vp-page">
        <ScreenTitle title={plan ? t("whatToBring") : t("planVisit")} sub={plan ? t("subDone") : t("subIdle")} />
        {!plan && (
          <div className="stack" style={{ ["--gap" as string]: "16px" }}>
            {appts === null && <Skeleton h={112} />}
            {appts && appts.length > 0 && <OptionList label={t("whichAppt")} options={options} value={pick} onChange={setPick} />}
            {(pick === "" || appts?.length === 0) && (
              <label className="ui-field">
                <span>{t("visitFor")}</span>
                <input className="ui-input" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} placeholder={t("purposePlaceholder")} />
              </label>
            )}
            {busy && (
              <ol className="lk-progress" aria-live="polite">
                <li className={`lk-prog is-${stage === "searching" ? "run" : "ok"}`}><span className="lk-prog-dot">{stage !== "searching" && <Icon name="check" size={13} />}</span><span className="grow">{t("searching")}</span><span className="lk-model">Claude · web{stage === "searching" ? ` · ${elapsed} s` : ""}</span></li>
                <li className={`lk-prog is-${stage === "comparing" ? "run" : "wait"}`}><span className="lk-prog-dot" /><span className="grow">{t("comparing")}</span><span className="lk-model">{stage === "comparing" ? `${elapsed} s` : ""}</span></li>
              </ol>
            )}
            {busy && elapsed > 20 && <p className="muted" style={{ margin: 0 }}>{t("slow")}</p>}
            {error && <InlineError message={error.message} onRetry={error.retryable ? () => void build() : undefined} />}
          </div>
        )}
        {plan && <VisitPlanView plan={plan} onAgain={() => { setPlan(null); setStage("idle"); }} />}
      </MobilePage>
      {!plan && (
        <StickyActionBar>
          <Button variant="primary" icon="globe" loading={busy} disabled={!canBuild || busy} onClick={() => void build()}>{busy ? t("building") : t("build")}</Button>
        </StickyActionBar>
      )}
    </>
  );
}
