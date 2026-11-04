"use client";

import { useState } from "react";
import { api, type ApiFailure } from "@/lib/client/api";
import { todayIso } from "@/lib/client/format";
import { useCase, useDossier } from "@/lib/client/store";
import type { LetterLink, LetterRead } from "@/lib/client/types";
import { ErrorNote, Loading } from "../../States";
import { LetterPicker } from "./LetterPicker";
import { LetterReading } from "./LetterReading";
import { LetterLinked } from "./LetterLinked";

export function LettersFlow() {
  const d = useDossier();
  const { refreshMe } = useCase();
  const [pages, setPages] = useState<string[]>([]);
  const [read, setRead] = useState<LetterRead | null>(null);
  const [link, setLink] = useState<LetterLink | null>(null);
  const [delivery, setDelivery] = useState(d.sample ? "2026-10-27" : todayIso());
  const [busy, setBusy] = useState<"read" | "link" | null>(null);
  const [err, setErr] = useState<{ f: ApiFailure | string; retry?: () => void } | null>(null);

  const doRead = async (imgs: string[]) => {
    setPages(imgs);
    setRead(null);
    setLink(null);
    setErr(null);
    setBusy("read");
    const r = await api.readLetter(imgs, d.case.profile.language);
    setBusy(null);
    void refreshMe();
    if (!r.ok) {
      return setErr({ f: r, retry: () => void doRead(imgs) });
    }
    setRead(r.data);
    d.logRuns("letter.read", r.data.runs ?? [r.data.run]);
  };

  const doLink = async () => {
    if (!read) return;
    setErr(null);
    setBusy("link");
    const r = await api.linkLetter(d.case, read.letter, delivery);
    setBusy(null);
    if (!r.ok) {
      return setErr({ f: r, retry: () => void doLink() });
    }
    setLink(r.data);
    d.logRuns("letter.link", r.data.runs?.length ? r.data.runs : [r.data.run]);
  };

  const reset = () => {
    setPages([]);
    setRead(null);
    setLink(null);
    setErr(null);
  };

  return (
    <div className="page page-wide stack" style={{ ["--gap" as string]: "18px" }}>
      <div>
        <span className="tab-label">Letters · read, link, reply</span>
        <h1 className="page-title">Read an official letter</h1>
        <p className="muted" style={{ margin: 0 }}>
          A photo or the PDF from e-Doręczenia. Pages are resized on your phone before upload. You see the exact Polish text next to the explanation.
        </p>
      </div>

      {!pages.length && <LetterPicker sample={d.sample} freeUsed={false} onPages={(p) => void doRead(p)} onError={(m) => setErr({ f: m })} />}

      {pages.length > 0 && (
        <div className="page-thumbs" aria-label="Pages sent">
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`Letter page ${i + 1}`} />
          ))}
          <button className="btn btn-ghost btn-small" onClick={reset}>Use a different letter</button>
        </div>
      )}

      {busy === "read" && (
        <div className="card working">
          <Loading label="Muse Spark is transcribing the Polish text, then explaining it…" />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>Usually 4 to 8 seconds per page.</p>
        </div>
      )}
      {err && <ErrorNote failure={err.f} onRetry={err.retry} />}

      {read && (
        <LetterReading
          read={read}
          delivery={delivery}
          onDelivery={setDelivery}
          onLink={() => void doLink()}
          linking={busy === "link"}
          linked={!!link}
        />
      )}

      {busy === "link" && (
        <div className="card working">
          <Loading label="Muse Spark is reading your whole case to see where this letter fits…" />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>Whole-case reasoning takes 8 to 20 seconds. The deadline itself is counted in code, not by the model.</p>
        </div>
      )}

      {read && link && <LetterLinked read={read} link={link} delivery={delivery} onDone={reset} />}
    </div>
  );
}
