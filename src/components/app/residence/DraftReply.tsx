"use client";
import { useState } from "react";
import { Button, InlineError } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { call, friendlyError } from "@/lib/client/api";
import { useT } from "@/lib/i18n/client";
import { Block } from "@/components/residence/parts";

type Draft = { kind: "reply" | "institution"; title: string; to: string; subject: string; body: string; language: "pl" | "en" };

/** A Polish cover reply to the office (and a request to an institution when one must issue a document). The person sends it. */
export function DraftReply({ documentId }: { documentId: string }) {
  const t = useT("residence");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    const r = await call<{ drafts: Draft[] }>("/api/letters/draft", { method: "POST", body: JSON.stringify({ documentId }) });
    setBusy(false);
    if (r.ok) setDrafts(r.data.drafts);
    else setError(friendlyError(r));
  };
  return (
    <Block title={t("draftTitle")}>
      {!drafts && <p className="rp-note">{t("draftIntro")}</p>}
      {error && <InlineError message={error} onRetry={() => void run()} />}
      {drafts?.length === 0 && <p className="rp-note">{t("draftNone")}</p>}
      {drafts?.map((d) => (
        <div key={d.kind} className="rs-draft">
          <div className="rs-draft-head"><b>{d.kind === "reply" ? t("draftReply") : t("draftInstitution")}</b><CopyButton text={`${d.subject}\n\n${d.body}`} label={t("draftCopy")} /></div>
          <p className="ui-meta">{t("draftTo")} {d.to}</p>
          <p className="rs-draft-subject" lang={d.language}>{d.subject}</p>
          <p className="rs-draft-body" lang={d.language}>{d.body}</p>
        </div>
      ))}
      {!drafts && <Button variant="secondary" icon="sparkle" loading={busy} onClick={() => void run()}>{t("draftMake")}</Button>}
      {drafts && <p className="rp-note">{t("draftCheck")}</p>}
    </Block>
  );
}
