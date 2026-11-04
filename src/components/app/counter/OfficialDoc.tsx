"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DocCard } from "@/lib/voice/protocol";
import { Icon } from "@/components/Icon";

const LABEL_PL: Record<string, string> = {
  newAddress: "Nowy adres", movedOn: "Od dnia", address: "Adres", startDate: "Od dnia", oldAddress: "Adres we wniosku", applicationAddress: "Adres we wniosku",
  caseNumber: "Znak sprawy", until: "Do", rent: "Czynsz", holder: "Posiadacz", number: "Numer", nationality: "Obywatelstwo",
  expires: "Ważny do", valid_until: "Ważny do", insurer: "Ubezpieczyciel", cover: "Okres", university: "Uczelnia", programme: "Kierunek",
  filedAt: "Złożono", dated: "Data pisma", delivered: "Doręczono", received: "Doręczono", sender: "Nadawca", issued: "Wydano",
};
const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const VALUE_PL: Record<string, string> = { "Whole stay": "Cały okres pobytu" };
const value = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${Number(v.slice(8))} ${MONTHS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}` : VALUE_PL[v] ?? v);

/* Stored pages are fetched once per session into object URLs (the file route is no-store), so a page opens at once. */
const loaded = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();
function preload(url: string): Promise<string | null> {
  if (loaded.has(url)) return Promise.resolve(loaded.get(url)!);
  if (!loading.has(url)) {
    const p = fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? (loaded.set(url, URL.createObjectURL(b)), loaded.get(url)!) : null))
      .catch(() => null);
    loading.set(url, p);
  }
  return loading.get(url)!;
}

/** Warms the case's stored page images when the counter opens, before the official asks for anything. */
export async function preloadCaseFiles(): Promise<void> {
  const snap = await fetch("/api/case", { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const docs: Array<{ id: string; status: string; fileKey: string | null }> = snap?.documents ?? [];
  for (const d of docs) if (d.status === "have" && d.fileKey && /\.(png|jpe?g|webp)$/i.test(d.fileKey)) void preload(`/api/case/documents/${encodeURIComponent(d.id)}/file`);
}

function Page({ url, title, onFail }: { url: string; title: string; onFail: () => void }) {
  const [src, setSrc] = useState(() => loaded.get(url) ?? url);
  useEffect(() => {
    if (!loaded.has(url)) void preload(url).then((u) => u && setSrc(u));
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element -- a private, per-user stored page (blob or no-store route)
  return <img className="ct-view-page" src={src} alt={title} onError={onFail} />;
}

/** A letter Dossierly drafted, set as the page the official will receive. */
function Letter({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/);
  return (
    <article className="ct-view-paper ct-letter">
      {paras.map((p, i) => {
        const cls = i === 0 ? "is-date" : /^[A-ZĄĆĘŁŃÓŚŹŻ ]{12,}$/.test(p) ? "is-title" : i === paras.length - 1 ? "is-sign" : undefined;
        return <p key={i} className={cls} data-anchor={cls === "is-title" || undefined}>{p.split("\n").map((l, j) => (j ? [<br key={j} />, l] : l))}</p>;
      })}
    </article>
  );
}

function Fields({ doc }: { doc: DocCard }) {
  const order = Object.keys(LABEL_PL);
  const fields = Object.entries(doc.fields).filter(([k, v]) => LABEL_PL[k] && v).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  return (
    <article className="ct-view-paper">
      <h2 data-anchor>{doc.captionPl}</h2>
      {fields.length > 0 && (
        <dl>{fields.map(([k, v]) => <div key={k}><dt>{LABEL_PL[k]}</dt><dd>{value(v)}</dd></div>)}</dl>
      )}
    </article>
  );
}

/**
 * The document the official asked for, full-screen on the official's half: the stored page itself when the case has
 * one, the drafted letter's full text, or (no file) its details. The × returns the half to the live translation;
 * `caption` keeps the user's latest words in Polish visible underneath.
 */
export function OfficialDoc({ doc, caption, onClose }: { doc: DocCard; caption?: string; onClose: () => void }) {
  const drafted = doc.kind === "address_change";
  const [failed, setFailed] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = body.current;
    const anchor = el?.querySelector<HTMLElement>("[data-anchor]");
    if (el && anchor && drafted) el.scrollTop = Math.max(0, anchor.offsetTop - 12);
  }, [doc.docId, drafted]);
  const file = !failed && doc.file ? doc.file : null;
  return (
    <div className={`ct-view ${drafted ? "is-draft" : ""}`} role="region" aria-label={`Pokazuję: ${doc.captionPl}`}>
      <header className="ct-view-bar">
        <div className="ct-view-title">
          <b>{doc.captionPl}</b>
          <span>{drafted ? "Projekt pisma · do złożenia dziś · art. 41 § 1 KPA" : "Dokument z mojej sprawy"}</span>
        </div>
        <button type="button" className="ct-view-x" onClick={onClose} aria-label="Zamknij dokument"><Icon name="close" size={22} /></button>
      </header>
      <div className="ct-view-body" ref={body}>
        {file?.type === "image" ? (
          <Page url={file.url} title={doc.title} onFail={() => setFailed(true)} />
        ) : file?.type === "pdf" ? (
          <iframe className="ct-view-pdf" src={`${file.url}#view=FitH&toolbar=0`} title={doc.title} />
        ) : drafted && doc.textPl ? (
          <Letter text={doc.textPl} />
        ) : (
          <Fields doc={doc} />
        )}
      </div>
      {caption && <p className="ct-view-cap" aria-live="polite">{caption}</p>}
    </div>
  );
}
