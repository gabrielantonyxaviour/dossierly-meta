"use client";

import { useCallback, useRef, useState } from "react";
import type { CommitRequest, CommitResult, LookEvent, LookKind, LookOutline, LookRead } from "@/lib/look/types";
import type { PreparedImage } from "./image";
import { errorText, readNdjson } from "./ndjson";

export type LookPhase = "idle" | "reading" | "outlining" | "done" | "error";

export interface LookState {
  phase: LookPhase;
  image: PreparedImage | null;
  read: LookRead | null;
  outlines: Record<string, LookOutline>;
  readMs: number | null;
  samMs: number | null;
  error: { message: string; code?: string; retryable: boolean } | null;
  sample: boolean;
}

const EMPTY: LookState = { phase: "idle", image: null, read: null, outlines: {}, readMs: null, samMs: null, error: null, sample: false };

export function useLook() {
  const [state, setState] = useState<LookState>(EMPTY);
  const ctl = useRef<AbortController | null>(null);
  const last = useRef<{ image: PreparedImage; opts: RunOpts } | null>(null);

  const run = useCallback(async (image: PreparedImage, opts: RunOpts = {}) => {
    ctl.current?.abort();
    const ac = new AbortController();
    ctl.current = ac;
    last.current = { image, opts };
    setState({ ...EMPTY, phase: "reading", image, sample: !!opts.sample });
    try {
      const res = await fetch("/api/look", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: image.dataUrl, width: image.width, height: image.height, hint: opts.hint, question: opts.question || undefined, sample: opts.sample }),
        signal: ac.signal,
      });
      if (!res.ok) {
        const e = await errorText(res);
        setState((s) => ({ ...s, phase: "error", error: { ...e, retryable: res.status >= 500 || res.status === 429 } }));
        return;
      }
      let failed = false;
      await readNdjson<LookEvent>(res, (e) => {
        if (e.type === "read") setState((s) => ({ ...s, read: e.read, readMs: e.ms }));
        else if (e.type === "stage" && e.stage === "outlining") setState((s) => ({ ...s, phase: "outlining" }));
        else if (e.type === "outline") setState((s) => ({ ...s, outlines: { ...s.outlines, [e.outline.id]: e.outline } }));
        else if (e.type === "outlines_done") setState((s) => ({ ...s, samMs: e.ms }));
        else if (e.type === "stage" && e.stage === "done") setState((s) => ({ ...s, phase: s.read ? "done" : "error", error: s.read ? null : { message: "We could not read that image. Try a sharper photo.", retryable: true } }));
        else if (e.type === "error") {
          failed = true;
          setState((s) => ({ ...s, phase: s.read ? "done" : "error", error: { message: e.error, code: e.code, retryable: e.retryable } }));
        }
      }, ac.signal);
      if (!failed) setState((s) => (s.phase === "reading" || s.phase === "outlining" ? { ...s, phase: s.read ? "done" : "error", error: s.read ? s.error : { message: "The connection closed before the reading finished. Try again.", retryable: true } } : s));
    } catch (err) {
      if (ac.signal.aborted) return;
      setState((s) => ({ ...s, phase: "error", error: { message: err instanceof Error && err.message ? "We lost the connection while reading. Check your network and try again." : "Something went wrong.", retryable: true } }));
    }
  }, []);

  const retry = useCallback(() => {
    if (last.current) void run(last.current.image, last.current.opts);
  }, [run]);

  const reset = useCallback(() => {
    ctl.current?.abort();
    last.current = null;
    setState(EMPTY);
  }, []);

  return { state, run, retry, reset };
}

export interface RunOpts {
  hint?: LookKind;
  question?: string;
  sample?: boolean;
}

export async function commitLook(body: CommitRequest): Promise<CommitResult> {
  const res = await fetch("/api/look/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await errorText(res)).message);
  return (await res.json()) as CommitResult;
}
