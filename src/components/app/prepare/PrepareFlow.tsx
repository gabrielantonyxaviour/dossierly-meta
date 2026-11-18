"use client";

import { useEffect, useRef, useState } from "react";
import { api, pollTask, type ApiFailure } from "@/lib/client/api";
import { todayIso } from "@/lib/client/format";
import { OFFICES } from "@/lib/client/sample";
import { useDossier } from "@/lib/client/store";
import { useT } from "@/lib/i18n/client";
import type { AgentTask, HubChange, PrepareResult } from "@/lib/client/types";
import { ErrorNote } from "../../States";
import { AgentTrace } from "./AgentTrace";
import { PrepareResultView } from "./PrepareResultView";
import { DatePicker } from "../../ui/DatePicker";
import { Select } from "../../ui/Select";

/* The English purpose is what the agent receives; the label follows the interface language. */
const PURPOSES = [
  { value: "Hand in missing documents after a wezwanie", key: "purposeWezwanie" },
  { value: "Fingerprints (odciski palców)", key: "purposeFingerprints" },
  { value: "Collect the residence card (odbiór karty)", key: "purposeCollect" },
  { value: "Ask about the status of my case", key: "purposeStatus" },
] as const;

const OFFICE_OPTIONS = OFFICES.map((o) => ({ value: o, label: o.replace("Wydział Spraw Cudzoziemców MUW - ", "Mazowiecki · "), description: o.replace(" - ", " · ") }));

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function PrepareFlow() {
  const t = useT("prepare");
  const d = useDossier();
  const [office, setOffice] = useState(OFFICES.includes(d.case.office) ? d.case.office : OFFICES[0]);
  const [purpose, setPurpose] = useState<string>(d.letters.length ? PURPOSES[0].value : PURPOSES[1].value);
  const [date, setDate] = useState(d.nextAppointment?.date ?? plusDays(4));
  const [task, setTask] = useState<AgentTask<PrepareResult> | null>(null);
  const [started, setStarted] = useState<number | null>(null);
  const [err, setErr] = useState<ApiFailure | string | null>(null);
  const [changes, setChanges] = useState<HubChange[]>([]);
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    void api.hubChanges().then((r) => r.ok && setChanges(r.data.changes));
    return () => ctl.current?.abort();
  }, []);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setErr(null);
    setTask(null);
    setStarted(Date.now());
    const r = await api.prepare(d.case, { office, purpose, date });
    if (!r.ok) {
      setStarted(null);
      return setErr(r);
    }
    const done = await pollTask<PrepareResult>(r.data.taskId, setTask, c.signal);
    setStarted(null);
    if (!done.ok) return setErr(done);
    if (done.data.status === "failed") return setErr(done.data.error ?? t("failed"));
    d.logRuns("prepare", [done.data.run]);
  };

  const busy = started !== null;
  const result = task?.status === "done" ? task.result : undefined;

  return (
    <div className="page page-wide stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">{t("kicker")}</span>
        <h1 className="page-title">{t("title")}</h1>
        <p className="muted" style={{ margin: 0 }}>{t("lead")}</p>
      </div>

      <form className="card stack prep-form" onSubmit={(e) => void run(e)} style={{ ["--gap" as string]: "14px" }}>
        <div className="field">
          <span id="prep-office-label">{t("office")}</span>
          <Select id="prep-office" labelledBy="prep-office-label" value={office} onChange={setOffice} options={OFFICE_OPTIONS} />
        </div>
        <div className="field">
          <span id="prep-purpose-label">{t("purposeLabel")}</span>
          <Select id="prep-purpose" labelledBy="prep-purpose-label" value={purpose} onChange={setPurpose} options={PURPOSES.map((p) => ({ value: p.value, label: t(p.key) }))} />
        </div>
        <div className="field">
          <span id="prep-date-label">{t("date")}</span>
          <DatePicker id="prep-date" labelledBy="prep-date-label" value={date} min={todayIso()} onChange={setDate} />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? t("working") : result ? t("again") : t("cta")}</button>
      </form>

      {(busy || task) && <AgentTrace task={task} startedAt={started} />}
      {err && <ErrorNote failure={err} onRetry={() => void run()} />}
      {result && task && (
        <PrepareResultView
          result={result}
          task={task}
          hubChanges={changes}
          appointment={{ office, purpose, date }}
        />
      )}
    </div>
  );
}
