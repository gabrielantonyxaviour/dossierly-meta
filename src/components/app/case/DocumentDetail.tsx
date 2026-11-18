"use client";
import { ButtonLink, Card, EmptyState, Pill, Row, Section, Skeleton, StickyActionBar, TopBar } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { dayLabel } from "../format";
import { useCaseData } from "../shell/case-data";
import "./case.css";
import { isMissingPhoto, openPhotoTask, photoCheckHref } from "../photo-link";

/* Status labels are "case" messages doc_<status>; sources are docSrc_<source>. */
const TONE = { have: "ok", missing: "deadline", requested: "warn" } as const;
const SOURCES = ["upload", "email", "scan", "user", "agent"];
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");

/** A document, full screen: status, what was read from it, deadlines it started, and next actions. */
export function DocumentDetail({ id }: { id: string }) {
  const t = useT("case");
  const { snapshot, status } = useCaseData();
  const back = { href: "/app/case?tab=documents", label: t("backDocs") };
  if (status === "loading") return <div className="sh-page"><TopBar title={t("document")} back={back} large={false} /><Skeleton h={240} r={22} /></div>;
  const d = snapshot?.documents.find((x) => x.id === id);
  if (!snapshot || !d) return <div className="sh-page"><TopBar title={t("document")} back={back} large={false} /><EmptyState icon="file" title={t("docNotFound")} action={<ButtonLink href="/app/case?tab=documents" size="sm">{t("allDocuments")}</ButtonLink>}>{t("docNotFoundBody")}</EmptyState></div>;
  const fields = Object.entries(d.extractedFields);
  const deadlines = snapshot.deadlines.filter((x) => x.triggeredBy === d.id);
  const events = snapshot.events.filter((e) => e.refs.includes(d.id));
  const st = t(`doc_${d.status}`);
  const tone = TONE[d.status];
  const q = encodeURIComponent(d.status === "have" ? t("askHaveQ", { title: d.title }) : t("askGetQ", { title: d.title }));
  /* An emailed letter or scan whose file is stored: Look reads the real page and outlines what matters. */
  const readable = d.status === "have" && !!d.fileKey && (d.kind === "letter" || d.kind === "upo");
  const ask = <ButtonLink href={`/app/chat?q=${q}&attach=document:${d.id}`} variant={d.status === "have" && !readable ? "primary" : "ghost"} icon="sparkle">{t("askDoc")}</ButtonLink>;
  return (
    <div className={`sh-page ${d.status !== "have" || d.kind === "letter" ? "sh-page--actions2" : "sh-page--actions"}`}>
      <TopBar title={d.title} back={back} eyebrow={SOURCES.includes(d.source) ? t(`docSrc_${d.source}`) : undefined} actions={<Pill tone={tone} dot>{st}</Pill>} />
      {d.status !== "have" ? (
        <Card className="dt-hero">
          <p className="ui-title">{d.status === "requested" ? t("officeAsked") : t("stillMissing")}</p>
          <p className="ui-body">{d.status === "requested" ? t("officeAskedBody") : t("stillMissingBody")}</p>
        </Card>
      ) : (
        <div className="dt-preview" aria-label={t("docFile")}>
          <EmptyState icon={d.kind === "photo" ? "photo" : "file"} title={d.fileKey ? t("stored") : t("noFile")}>
            {d.pages ? t("pagesAdded", { pages: d.pages === 1 ? t("pagesOne") : t("pagesMany", { n: d.pages }), date: dayLabel(d.createdAt.slice(0, 10)) }) : t("added", { date: dayLabel(d.createdAt.slice(0, 10)) })}
          </EmptyState>
        </div>
      )}

      {fields.length > 0 && (
        <Section title={t("whatRead")}>
          <Card flush><dl className="dt-fields">{fields.map(([k, v]) => <div key={k}><dt>{label(k)}</dt><dd>{v}</dd></div>)}</dl></Card>
        </Section>
      )}

      {deadlines.length > 0 && (
        <Section title={t("deadlinesStarted")}>
          <Card flush>{deadlines.map((x) => <Row key={x.id} href={`/app/case/deadlines/${x.id}`} chevron icon="clock" iconBg="var(--deadline-soft)" iconColor="var(--deadline)" title={x.title} sub={`${t("dueOn", { date: dayLabel(x.dueDate) })}${x.computation.rule ? ` · ${x.computation.rule}` : ""}`} />)}</Card>
        </Section>
      )}

      {events.length > 0 && (
        <Section title={t("history")}>
          <Card flush>{events.map((e) => <Row key={e.id} icon="clock" title={e.summary} sub={dayLabel(e.at.slice(0, 10))} href={`/app/case?tab=timeline#${e.id}`} />)}</Card>
        </Section>
      )}

      {d.status !== "have" ? (
        <StickyActionBar secondary={ask}>{isMissingPhoto(d)
          ? <ButtonLink href={photoCheckHref(openPhotoTask(snapshot)?.id)} variant="primary" icon="camera">{t("checkAPhoto")}</ButtonLink>
          : <ButtonLink href="/app/look" variant="primary" icon="scan">{t("addWithLook")}</ButtonLink>}</StickyActionBar>
      ) : (
        <StickyActionBar secondary={readable ? ask : d.kind === "letter" ? <ButtonLink href="/app/look" variant="ghost" icon="scan">{t("lookAgain")}</ButtonLink> : undefined}>
          {readable ? <ButtonLink href={`/app/look?doc=${encodeURIComponent(d.id)}`} variant="primary" icon="scan">{t("readWithLook")}</ButtonLink> : ask}
        </StickyActionBar>
      )}
    </div>
  );
}
