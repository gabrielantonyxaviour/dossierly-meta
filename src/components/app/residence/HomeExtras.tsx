"use client";
import { Card, CheckCircle, Row, Section } from "@/components/ui";
import type { CaseSnapshot } from "@/lib/case/types";
import { checklist } from "@/lib/residence/checklist";
import { currentStage } from "@/lib/residence/stage";
import { VOIVODESHIP_INFO } from "@/lib/residence/model";
import { useT } from "@/lib/i18n/client";
import { useResidence } from "./useResidence";

/* Home extras: the first open Prepare items (tick them right here), and the optional connections that used to be
   setup steps (mail, forwarding address, phone alerts). */

export function PrepareStart({ c }: { c: CaseSnapshot }) {
  const t = useT("residence");
  const { act, busy } = useResidence();
  const stage = currentStage(c);
  if (stage !== "prepare" && stage !== "file") return null;
  const items = checklist(c);
  const open = items.filter((i) => !i.done);
  if (!open.length) return null;
  const region = c.profile.voivodeship ? VOIVODESHIP_INFO[c.profile.voivodeship] : null;
  const vars = (v?: Record<string, string | number>) => ({ ...v, seat: region?.seat ?? t("yourCity"), office: region?.office ?? t("yourVoivodeOffice") });
  return (
    <Section title={t("startHere")} action={{ label: t("allItems", { n: items.length }), href: "/app/residence/prepare" }}>
      <Card flush>
        {open.slice(0, 4).map((it) => {
          const title = t(`check_${it.key}`, vars(it.vars));
          return (
            <Row key={it.id} title={title} sub={t(`check_${it.key}Sub`, vars(it.vars))}
              icon={<CheckCircle checked={false} disabled={busy} label={t("tick", { title })} onChange={() => void act({ action: "tick", item: it.id, done: true }, t("ticked", { title }))} />} />
          );
        })}
      </Card>
    </Section>
  );
}

export function OptionalSetup() {
  const t = useT("residence");
  return (
    <Section title={t("optionalTitle")}>
      <Card flush>
        <Row icon="mail" title={t("optMail")} sub={t("optMailSub")} href="/app/connections" chevron />
        <Row icon="send" title={t("optForward")} sub={t("optForwardSub")} href="/app/connections" chevron />
        <Row icon="phone" title={t("optPhone")} sub={t("optPhoneSub")} href="/app/settings" chevron />
      </Card>
    </Section>
  );
}
