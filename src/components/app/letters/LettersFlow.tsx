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
import { useT } from "@/lib/i18n/client";

export function LettersFlow() {
  const t = useT("letters");
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
        <span className="tab-label">{t("kicker")}</span>
        <h1 className="page-title">{t("pageTitle")}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {t("pageLead")}
        </p>
      </div>

      {!pages.length && <LetterPicker sample={d.sample} freeUsed={false} onPages={(p) => void doRead(p)} onError={(m) => setErr({ f: m })} />}

      {pages.length > 0 && (
        <div className="page-thumbs" aria-label={t("pagesSent")}>
          {pages.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={t("pageAlt", { n: i + 1 })} />
          ))}
          <button className="btn btn-ghost btn-small" onClick={reset}>{t("differentLetter")}</button>
        </div>
      )}

      {busy === "read" && (
        <div className="card working">
          <Loading label={t("readingLabel")} />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t("readingTime")}</p>
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
          <Loading label={t("linkingLabel")} />
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>{t("linkingTime")}</p>
        </div>
      )}

      {read && link && <LetterLinked read={read} link={link} delivery={delivery} onDone={reset} />}
    </div>
  );
}
