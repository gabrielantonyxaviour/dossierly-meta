"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorState, IconLink, Segmented, Skeleton, TopBar } from "@/components/ui";
import { PERMIT_LABEL, STAGE_LABEL } from "../format";
import { useCaseData } from "../shell/case-data";
import { CaseHeader } from "./CaseHeader";
import { KeyCards } from "./KeyCards";
import { DatesTab, DocumentsTab, TasksTab } from "./CaseTabs";
import { TimelineTab } from "./TimelineTab";
import "./case.css";

const TABS = ["timeline", "dates", "documents", "tasks"] as const;
type Tab = (typeof TABS)[number];

export function CaseScreen() {
  const { status, snapshot, error, refresh } = useCaseData();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as Tab) : "timeline";
  const setTab = (t: Tab) => router.replace(`/app/case?tab=${t}`, { scroll: false });
  if (status === "loading") return <div className="sh-page"><div style={{ height: 56 }} /><Skeleton h={40} w="50%" /><Skeleton h={160} r={22} /><Skeleton h={300} r={22} /></div>;
  if (!snapshot) return <div className="sh-page"><ErrorState message={error ?? "Your case didn’t load."} onRetry={() => void refresh()} /></div>;
  const c = snapshot;
  const openTasks = c.tasks.filter((t) => t.status === "open").length;
  const openDates = c.deadlines.filter((d) => d.status === "open").length + c.appointments.length;
  return (
    <div className="sh-page cs">
      <TopBar
        title="Your case"
        eyebrow={c.profile.permitType ? PERMIT_LABEL[c.profile.permitType] : "Residence case"}
        sub={STAGE_LABEL[c.profile.stage]}
        actions={<IconLink href={`/app/chat?q=${encodeURIComponent("Summarise where my case stands and what could go wrong next.")}`} icon="sparkle" label="Ask about your case" />}
      />
      <CaseHeader c={c} />
      <KeyCards c={c} />
      <div className="cs-tabs">
        <Segmented label="Case sections" value={tab} onChange={setTab} options={[
          { value: "timeline", label: "Timeline" },
          { value: "dates", label: "Dates", count: openDates },
          { value: "documents", label: "Documents", count: c.documents.length },
          { value: "tasks", label: "Tasks", count: openTasks },
        ]} />
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === "timeline" && <TimelineTab c={c} />}
        {tab === "dates" && <DatesTab c={c} />}
        {tab === "documents" && <DocumentsTab c={c} />}
        {tab === "tasks" && <TasksTab c={c} />}
      </div>
    </div>
  );
}
