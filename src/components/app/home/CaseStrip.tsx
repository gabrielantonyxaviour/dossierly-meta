"use client";
import { FACT_KEYS, type CaseSnapshot } from "@/lib/case/types";
import { Card, Pill, Row, Section, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";
import { permitLabel, stageLabel } from "../format";

const SOURCES = ["email", "letter", "screenshot", "user", "call"];
/** Fact name in the interface language ("home" namespace translator). */
export const factLabel = (t: T, k: (typeof FACT_KEYS)[number]) => t(`fact_${k}`);
/** Where a fact came from, in the interface language ("home" namespace translator). */
export const sourceLabel = (t: T, type: string) => (SOURCES.includes(type) ? t(`source_${type}`) : "");

/** Key facts with where each one came from. Case number copies on tap. */
export function CaseStrip({ c }: { c: CaseSnapshot }) {
  const t = useT("home");
  const { toast } = useToast();
  const facts = (["caseNumber", "office", "filedAt"] as const).flatMap((k) => (c.facts[k] ? [[k, c.facts[k]!] as const] : []));
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); toast(t("caseNumberCopied"), { tone: "ok" }); } catch { toast(t("copyFailedLongPress"), { tone: "error" }); }
  };
  return (
    <Section title={t("yourCase")} action={{ label: t("openCase"), href: "/app/case" }}>
      <Card flush>
        <Row icon="case" title={permitLabel(c.profile.permitType)} sub={[stageLabel(c.profile.stage), c.profile.organisation].filter(Boolean).join(" · ")} />
        {facts.map(([k, f]) => (
          <Row key={k} title={<span className={k === "caseNumber" ? "ui-num" : undefined}>{f.value}</span>} sub={factLabel(t, k)}
            end={<Pill tone={f.confirmedByUser ? "ok" : "outline"}>{sourceLabel(t, f.source.type)}</Pill>}
            onClick={k === "caseNumber" ? () => void copy(f.value) : undefined} />
        ))}
        {!facts.length && <Row title={t("noCaseNumber")} sub={t("noCaseNumberSub")} />}
      </Card>
    </Section>
  );
}
