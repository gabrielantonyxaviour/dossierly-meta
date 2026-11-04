"use client";
import { FACT_KEYS, type CaseSnapshot } from "@/lib/case/types";
import { Card, Pill, Row, Section, useToast } from "@/components/ui";
import { PERMIT_LABEL, STAGE_LABEL } from "../format";

export const FACT_LABEL: Record<(typeof FACT_KEYS)[number], string> = {
  caseNumber: "Case number", office: "Office", filedAt: "Filed", upoReceivedAt: "UPO receipt", mosStatus: "MOS status", inpolStatus: "inPOL status",
};
export const SOURCE_LABEL: Record<string, string> = { email: "From email", letter: "From letter", screenshot: "From screenshot", user: "You told us", call: "From call" };

/** Key facts with where each one came from. Case number copies on tap. */
export function CaseStrip({ c }: { c: CaseSnapshot }) {
  const { toast } = useToast();
  const facts = (["caseNumber", "office", "filedAt"] as const).flatMap((k) => (c.facts[k] ? [[k, c.facts[k]!] as const] : []));
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast("Case number copied", { tone: "ok" }); } catch { toast("Couldn’t copy. Long-press to select it.", { tone: "error" }); }
  };
  return (
    <Section title="Your case" action={{ label: "Open case", href: "/app/case" }}>
      <Card flush>
        <Row icon="case" title={c.profile.permitType ? PERMIT_LABEL[c.profile.permitType] : "Residence case"} sub={[STAGE_LABEL[c.profile.stage], c.profile.organisation].filter(Boolean).join(" · ")} />
        {facts.map(([k, f]) => (
          <Row key={k} title={<span className={k === "caseNumber" ? "ui-num" : undefined}>{f.value}</span>} sub={FACT_LABEL[k]}
            end={<Pill tone={f.confirmedByUser ? "ok" : "outline"}>{SOURCE_LABEL[f.source.type]}</Pill>}
            onClick={k === "caseNumber" ? () => void copy(f.value) : undefined} />
        ))}
        {!facts.length && <Row title="No case number yet" sub="It arrives by email after you file in MOS. Dossierly adds it when it sees it." />}
      </Card>
    </Section>
  );
}
