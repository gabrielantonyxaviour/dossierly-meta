"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, ButtonLink, InlineError, MobileFlowHeader, MobilePage, ScreenTitle, StickyActionBar } from "@/components/ui";
import { prepareImage, type PreparedImage } from "../look/image";
import { errorText } from "../look/ndjson";
import { PhotoOutcome, type OriginalInfo } from "./PhotoOutcome";
import { PhotoStage } from "./PhotoStage";
import { MOS_H, MOS_W, renderMosPhoto, type PhotoResult } from "./types";
import { announceCaseChange } from "../shell/case-data";
import "../look/look.css";
import "./photo.css";

const MARK = { pass: "✓", fail: "!", unsure: "?" } as const;
const PHOTO_TASK = /photo|zdj[eę]ci|fotograf/i;
type Task = { id: string; title: string; detail: string; status: string };

async function sizeOf(file: Blob): Promise<{ width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = { width: bmp.width, height: bmp.height };
  bmp.close();
  return s;
}
const toDataUrl = (b: Blob) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(r.error); r.readAsDataURL(b); });

export function PhotoFlow() {
  const input = useRef<HTMLInputElement>(null);
  const outcome = useRef<HTMLElement>(null);
  const [original, setOriginal] = useState<Blob | null>(null);
  const [before, setBefore] = useState<OriginalInfo | null>(null);
  const [img, setImg] = useState<PreparedImage | null>(null);
  const [result, setResult] = useState<PhotoResult | null>(null);
  const [out, setOut] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [saved, setSaved] = useState<"idle" | "saving" | "done" | "error">("idle");

  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);
  useEffect(() => () => { if (before) URL.revokeObjectURL(before.url); }, [before]);
  useEffect(() => { if (out) outcome.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [out]);

  /* The task this photo is for: ?task=<id>, else the open photo task in the case. */
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("task");
    let live = true;
    fetch("/api/case/tasks").then((r) => (r.ok ? (r.json() as Promise<Task[]>) : [])).then((tasks) => {
      if (!live) return;
      setTask((want ? tasks.find((t) => t.id === want) : tasks.find((t) => t.status === "open" && PHOTO_TASK.test(`${t.title} ${t.detail}`))) ?? null);
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const check = async (file: Blob) => {
    setError(null); setResult(null); setOut(null); setSaved("idle"); setBusy(true);
    try {
      const [p, dims] = await Promise.all([prepareImage(file, 1600), sizeOf(file)]);
      setOriginal(file); setImg(p);
      setBefore({ url: URL.createObjectURL(file), ...dims, bytes: file.size });
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

  const attach = async () => {
    if (!out) return;
    setSaved("saving");
    try {
      const res = await fetch("/api/photo/attach", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: await toDataUrl(out.blob), width: MOS_W, height: MOS_H, taskId: task?.id, originalBytes: before?.bytes, originalSize: before ? `${before.width}x${before.height}` : undefined }),
      });
      if (!res.ok) throw new Error((await errorText(res)).message);
      setSaved("done");
      announceCaseChange();
    } catch {
      setSaved("error");
    }
  };

  const fails = result?.checks.filter((c) => c.status === "fail") ?? [];
  const attachLabel = task ? "Attach to task" : "Add to my case";
  return (
    <>
    <MobileFlowHeader back="/app/look" backLabel="Back to Look" title="Photo check" />
    <MobilePage actions={out ? "double" : true} wide className="lk-page">
      <ScreenTitle title="Your MOS photo" sub={task ? `For your task: ${task.title}` : "I find your head, check the rules and crop to exactly what MOS asks. Nothing is retouched."} />
      {!img && (
        <dl className="ph-spec" aria-label="What MOS asks for">
          {[["Size", `${MOS_W} × ${MOS_H} px`], ["Shape", "35 × 45 mm"], ["File", "Up to 2.5 MB"], ["Taken", "Last 6 months"]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
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
        <div className="lk-result" style={{ marginTop: 16 }}>
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
                {out && before && <PhotoOutcome ref={outcome} original={before} out={out} result={result} />}
                {saved === "done" && <div className="lk-saved" role="status"><Icon name="check" size={18} /><span className="grow">Attached to {task ? `“${task.title}”` : "your case"}. {task ? "Task done." : ""}</span></div>}
                {saved === "error" && <p className="small" role="alert" style={{ margin: 0 }}>Could not update your case. Try again.</p>}
                <div className="ph-rules-head"><span className="tab-label">All photo rules</span>{fails.length > 0 && <span className="ui-pill ui-pill--deadline">{fails.length} rule{fails.length === 1 ? "" : "s"} to fix first</span>}</div>
                <ul className="ph-checks">
                  {result.checks.map((c) => (
                    <li key={c.id} className={`ph-check is-${c.status}`}><span className="ph-mark" aria-label={c.status}>{MARK[c.status]}</span><div><b>{c.label}</b>{c.note && <p>{c.note}</p>}</div></li>
                  ))}
                </ul>
                {out && (
                  <>
                    <label className="check ph-recent"><input type="checkbox" checked={recent} onChange={(e) => setRecent(e.target.checked)} /> This photo was taken in the last 6 months.</label>
                    <p className="tiny muted" style={{ margin: 0 }}>Only cropped and resized. Upload this file in MOS yourself; Dossierly never files for you.</p>
                  </>
                )}
                {!busy && <div><Button variant="ghost" icon="camera" onClick={() => input.current?.click()}>Use another photo</Button></div>}
              </>
            )}
          </div>
        </div>
      )}
    </MobilePage>
      <StickyActionBar secondary={out && !busy ? (
        <a className={`ui-btn ui-btn--ghost${recent ? "" : " is-disabled"}`} href={recent ? out.url : undefined} download="mos-photo-684x883.jpg" aria-disabled={!recent} onClick={(e) => { if (!recent) e.preventDefault(); }}>
          <Icon name="arrow" size={19} /> {recent ? "Download photo" : "Tick the 6-month box to download"}
        </a>
      ) : undefined}>
        {out && result?.crop ? (
          saved === "done"
            ? <ButtonLink variant="primary" href="/app" icon="check">Open my case</ButtonLink>
            : <Button variant="primary" loading={saved === "saving"} disabled={saved === "saving"} onClick={() => void attach()}>{saved === "saving" ? "Attaching…" : attachLabel}</Button>
        ) : (
          <Button variant="primary" icon="camera" loading={busy} disabled={busy} onClick={() => input.current?.click()}>{busy ? "Checking…" : img ? "Use another photo" : "Choose your photo"}</Button>
        )}
      </StickyActionBar>
    </>
  );
}
