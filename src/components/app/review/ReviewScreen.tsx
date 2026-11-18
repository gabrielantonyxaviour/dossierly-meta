"use client";
import { useEffect, useRef, useState } from "react";
import { Button, EmptyState, ErrorState, Section, Skeleton, StickyActionBar, TopBar, useToast } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import { ago } from "../format";
import { announceCaseChange, useCaseData } from "../shell/case-data";
import { bySeverity, proposals, type StoredReview } from "./derive";
import { InconsistencyCard, Plan, ProposalCard, RiskCard } from "./ReviewParts";
import "./review.css";

type Load = { state: "loading" } | { state: "ready"; review: StoredReview | null } | { state: "error"; error: string };

/** Muse Wonder's long-horizon case review: risks, dated plan, inconsistencies, questions and proposals to accept. */
export function ReviewScreen() {
  const t = useT("review");
  const { snapshot, status, refresh } = useCaseData();
  const { toast } = useToast();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(0);

  const fetchReview = async () => {
    const res = await fetch("/api/case/review", { cache: "no-store" }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { review?: StoredReview | null; error?: string };
    return res?.ok ? ({ state: "ready", review: body.review ?? null } as const) : ({ state: "error", error: body.error ?? t("loadFailed") } as const);
  };
  useEffect(() => {
    let live = true;
    void fetchReview().then((l) => live && setLoad(l));
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  const run = async () => {
    started.current = Date.now();
    setElapsed(0);
    setRunning(true);
    const res = await fetch("/api/case/review", { method: "POST" }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { review?: StoredReview; changed?: boolean; status?: string; error?: string };
    setRunning(false);
    if (!res?.ok || !body.review) return toast(body.error ?? t("runFailed"), { tone: "error" });
    setLoad({ state: "ready", review: body.review });
    if (body.changed) { announceCaseChange(); void refresh(); }
    toast(body.status === "unchanged" ? t("unchanged") : t("updated"), { tone: "ok" });
  };

  const back = { href: "/app/case", label: t("backCase") };
  const bar = (
    <StickyActionBar note={running ? t("runningNote", { s: elapsed }) : undefined}>
      <Button variant="primary" icon={running ? undefined : "sparkle"} loading={running} disabled={running} onClick={() => void run()}>
        {running ? t("running") : t("runNow")}
      </Button>
    </StickyActionBar>
  );
  if (status === "loading" || load.state === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="55%" /><Skeleton h={120} r={20} /><Skeleton h={260} r={20} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={t("caseLoadFailed")} onRetry={() => void refresh()} /></div>;
  if (load.state === "error") return <div className="sh-page"><TopBar title={t("title")} back={back} /><ErrorState message={load.error} onRetry={() => void fetchReview().then(setLoad)} /></div>;

  const r = load.review;
  const props = proposals(snapshot);
  if (!r) {
    return (
      <div className="sh-page sh-page--actions2">
        <TopBar title={t("title")} back={back} />
        <EmptyState icon="sparkle" title={t("noReview")}>
          {t("noReviewBody")}
        </EmptyState>
        {bar}
      </div>
    );
  }
  return (
    <div className="sh-page sh-page--actions2 rv">
      <TopBar title={t("title")} back={back} eyebrow={r.reviewedAt ? t("eyebrowReviewed", { ago: ago(r.reviewedAt).toLowerCase() }) : t("eyebrowLatest")} sub={r.summary} />

      {props.length > 0 && (
        <Section title={t("proposedFor", { n: props.length })}>
          <div className="rv-list">{props.map((t) => <ProposalCard key={t.id} t={t} />)}</div>
        </Section>
      )}
      {r.risks.length > 0 && (
        <Section title={t("risksSection", { n: r.risks.length })}>
          <div className="rv-list">{[...r.risks].sort(bySeverity).map((x, i) => <RiskCard key={i} r={x} c={snapshot} />)}</div>
        </Section>
      )}
      {r.inconsistencies.length > 0 && (
        <Section title={t("mismatch", { n: r.inconsistencies.length })}>
          <div className="rv-list">{r.inconsistencies.map((x, i) => <InconsistencyCard key={i} x={x} c={snapshot} />)}</div>
        </Section>
      )}
      {r.plan.length > 0 && <Section title={t("plan")}><Plan steps={r.plan} /></Section>}
      {r.questions.length > 0 && (
        <Section title={t("questions")}>
          <div className="rv-questions">
            {r.questions.map((q, i) => (
              <a key={i} className="rv-q" href={`/app/chat?q=${encodeURIComponent(q)}`}><Icon name="help" size={18} /><span>{q}</span><Icon name="forward" size={16} /></a>
            ))}
          </div>
        </Section>
      )}
      <p className="ui-meta">{t("disclaimer")}{r.costUsd ? ` ${t("costNote", { cost: r.costUsd.toFixed(3) })}` : ""}</p>
      {bar}
    </div>
  );
}
