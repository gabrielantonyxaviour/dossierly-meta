"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, InlineError, MobileFlowHeader, MobilePage, ScreenTitle, StickyActionBar } from "@/components/ui";
import { formatBytes } from "@/components/ui/Dropzone";
import { prepareImage, type PreparedImage } from "../look/image";
import { errorText } from "../look/ndjson";
import { PhotoStage } from "./PhotoStage";
import { MOS_H, MOS_W, renderMosPhoto, type PhotoResult } from "./types";
import { announceCaseChange } from "../shell/case-data";
import "../look/look.css";
import "./photo.css";

const MARK = { pass: "✓", fail: "!", unsure: "?" } as const;

export function PhotoFlow() {
  const input = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState<Blob | null>(null);
  const [img, setImg] = useState<PreparedImage | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [out, setOut] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);

  const check = async (file: Blob) => {
    setError(null); setResult(null); setOut(null); setSaved("idle"); setBusy(true);
    try {
      const p = await prepareImage(file, 1600);
      setOriginal(file); setImg(p);
      const res = await fetch("/api/photo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ image: p.dataUrl, width: p.width, height: p.height }) });
      if (!res.ok) throw new Error((await errorText(res)).message);
      const r = (await res.json()) as PhotoResult;
      setResult(r);
      if (r.crop?.fits) setOut(await renderMosPhoto(file, p, r.crop));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo check failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setSaved("saving");
    const res = await fetch("/api/case/documents", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "photo", title: `MOS photo ${MOS_W}×${MOS_H}`, status: "have", source: "upload", extractedFields: { size: `${MOS_W}x${MOS_H}`, bytes: String(out?.blob.size ?? 0), checkedOn: new Date().toISOString().slice(0, 10) } }),
    }).catch(() => null);
    setSaved(res?.ok ? "done" : "error");
    if (res?.ok) announceCaseChange();
  };

  const fails = result?.checks.filter((c) => c.status === "fail") ?? [];
  return (
    <>
    <MobileFlowHeader back="/app/look" backLabel="Back to Look" title="Photo check" />
    <MobilePage actions={out ? "double" : true} wide className="lk-page">
      <ScreenTitle title="Your MOS photo" sub="I find your head, check the rules and crop to exactly what MOS asks. Nothing is retouched." />
      <dl className="ph-spec" aria-label="What MOS asks for">
        {[["Size", `${MOS_W} × ${MOS_H} px`], ["Shape", "35 × 45 mm"], ["File", "Up to 2.5 MB"], ["Taken", "Last 6 months"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void check(f); e.target.value = ""; }} />
      {!img && (
        <div className="lk-capture" style={{ marginTop: 20 }}>
          <div className="ph-art" aria-hidden="true"><span /></div>
          <div className="lk-capture-actions">
            <p className="lk-capture-copy">Best: someone else takes it, you face the camera against a plain light wall, in daylight.</p>
          </div>
        </div>
      )}
      {error && <InlineError message={error} onRetry={original ? () => void check(original) : undefined} />}
      {img && (
        <div className="lk-result" style={{ marginTop: 20 }}>
          <div className="lk-visual"><PhotoStage src={img.dataUrl} width={img.width} height={img.height} busy={busy} result={result} /></div>
          <div className="lk-panel stack" style={{ ["--gap" as string]: "16px" }}>
            <ol className="lk-progress" aria-live="polite">
              <li className={`lk-prog is-${busy ? "run" : "ok"}`}><span className="lk-prog-dot">{!busy && <Icon name="check" size={13} />}</span><span className="grow">Finding your head and checking the rules</span><span className="lk-model">SAM 3.1 + Muse Spark{result ? ` · ${(Math.max(result.timings.samMs, result.timings.sparkMs) / 1000).toFixed(1)} s` : ""}</span></li>
            </ol>
            {busy && <div className="skeleton" style={{ height: 120 }} />}
            {result && (
              <>
                {!result.head && <div className="ui-inline-error">I couldn&apos;t find a head in this photo. Use a photo of one person facing the camera.</div>}
                {result.crop && !result.crop.fits && <div className="ui-inline-error">{result.crop.notes.join(" ") || "The photo doesn't leave enough space around your head to crop it correctly."}</div>}
                <ul className="ph-checks">
                  {result.checks.map((c) => (
                    <li key={c.id} className={`ph-check is-${c.status}`}><span className="ph-mark" aria-label={c.status}>{MARK[c.status]}</span><div><b>{c.label}</b>{c.note && <p>{c.note}</p>}</div></li>
                  ))}
                </ul>
                {out && result.crop && (
                  <section className="ui-card ph-out stack" style={{ ["--gap" as string]: "12px" }}>
                    <div className="ph-out-row">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
                      <img src={out.url} alt={`Your cropped MOS photo, ${MOS_W} by ${MOS_H} pixels`} />
                      <div className="stack" style={{ ["--gap" as string]: "6px" }}>
                        <h3 style={{ margin: 0 }}>Ready for MOS</h3>
                        <span className="mono small">{MOS_W} × {MOS_H} px · {formatBytes(out.blob.size)}</span>
                        <span className="small muted">Face height {Math.round(result.crop.headRatio * 100)}% of the photo.</span>
                        {result.crop.upscaled && <span className="ui-pill ui-pill--warn">Low resolution: enlarged to fit</span>}
                        {fails.length > 0 && <span className="ui-pill ui-pill--deadline">{fails.length} rule{fails.length === 1 ? "" : "s"} to fix first</span>}
                      </div>
                    </div>
                    <label className="check ph-recent"><input type="checkbox" checked={recent} onChange={(e) => setRecent(e.target.checked)} /> This photo was taken in the last 6 months.</label>
                    <div><Button size="sm" icon={saved === "done" ? "check" : undefined} onClick={() => void save()} disabled={saved === "saving" || saved === "done"}>{saved === "done" ? "In your case" : "Mark photo as ready"}</Button></div>
                    {saved === "error" && <p className="small" role="alert" style={{ margin: 0 }}>Could not update your case. Try again.</p>}
                    <p className="tiny muted" style={{ margin: 0 }}>Only cropped and resized. Upload this file in MOS yourself; Dossierly never files for you.</p>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </MobilePage>
      <StickyActionBar secondary={out && !busy ? <Button variant="ghost" icon="camera" onClick={() => input.current?.click()}>Use another photo</Button> : undefined}>
        {out && result?.crop ? (
          <a className={`ui-btn ui-btn--primary${recent ? "" : " is-disabled"}`} href={recent ? out.url : undefined} download="mos-photo-684x883.jpg" aria-disabled={!recent} onClick={(e) => { if (!recent) e.preventDefault(); }}>
            <Icon name="arrow" size={19} /> {recent ? "Download photo" : "Confirm the date to download"}
          </a>
        ) : (
          <Button variant="primary" icon="camera" loading={busy} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Checking…" : img ? "Use another photo" : "Choose your photo"}</Button>
        )}
      </StickyActionBar>
    </>
  );
}
