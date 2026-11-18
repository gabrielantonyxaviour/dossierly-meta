"use client";

import { useRef, useState } from "react";
import { fileToPages, urlToPages } from "@/lib/client/pages";
import { Icon } from "../../Icon";
import { Dropzone } from "../../ui/Dropzone";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";

export function LetterPicker({ sample, onPages, onError }: { sample: boolean; freeUsed: boolean; onPages(p: string[]): void; onError(m: string): void }) {
  const t = useT("letters");
  const camera = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const take = async (file?: File | null) => {
    if (!file) return;
    setPreparing(true);
    try {
      const { pages } = await fileToPages(file);
      if (!pages.length) throw new Error(t("errNoPages"));
      onPages(pages);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("errOpen"));
    } finally {
      setPreparing(false);
    }
  };

  const loadSample = async () => {
    setPreparing(true);
    try {
      onPages(await urlToPages("/sample/wezwanie-sample.png"));
    } catch {
      onError(t("errSample"));
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="card stack" aria-label={t("addLetter")}>
      <div className="ui-picker">
        <button className="pick ui-picker-camera" onClick={() => camera.current?.click()} disabled={preparing}>
          <Icon name="camera" size={28} />
          <b>{t("photograph")}</b>
          <small>{t("photographHint")}</small>
        </button>
        <Dropzone
          accept="application/pdf,image/*"
          onFile={(f) => void take(f)}
          hint={t("dropHint")}
          compactLabel={t("dropCompact")}
          disabled={preparing}
        />
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void take(e.target.files?.[0])} aria-label={t("letterPhoto")} />
      {sample && (
        <div className="sample-letter row">
          <span className="stamp">{t("sample")}</span>
          <span className="grow small">{rich(t("sampleText"), { wezwanie: <i lang="pl">wezwanie</i> })}</span>
          <button className="btn btn-primary btn-small" onClick={() => void loadSample()} disabled={preparing}>{t("useSample")}</button>
        </div>
      )}
      {preparing && <p className="small muted" role="status" style={{ margin: 0 }}>{t("preparing")}</p>}
      <p className="tiny muted" style={{ margin: 0 }}>{t("free")}</p>
    </section>
  );
}
