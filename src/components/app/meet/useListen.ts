"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCase } from "@/lib/client/store";
import { listenParakeet, PARAKEET_LANGS, type AsrDetail } from "@/lib/speech/parakeet";
import type { ListenHandle, ListenHandlers } from "@/lib/speech/types";
import { webSpeech } from "@/lib/speech/webspeech";

export type ListenState = "idle" | "listening" | "transcribing" | "error";
export type ListenEngine = "parakeet" | "browser";

/**
 * Tap-to-talk speech input. Polish, English and Ukrainian go to Muse Voice Transcribe when it is
 * online; other languages, or an offline host, use the browser's own recognition.
 */
export function useListen(lang: string, onText: (text: string) => void, opts: { translate?: "en" | "pl" } = {}) {
  const { status } = useCase();
  const [state, setState] = useState<ListenState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AsrDetail | null>(null);
  const [browserOk, setBrowserOk] = useState(true);
  const handle = useRef<ListenHandle | null>(null);
  const base = lang.split("-")[0].toLowerCase();
  const engine: ListenEngine = status?.asr?.online && PARAKEET_LANGS.has(base) ? "parakeet" : "browser";

  useEffect(() => {
    // Feature detection needs window; it is not available during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowserOk(webSpeech.canListen());
    return () => handle.current?.stop();
  }, []);

  const start = useCallback(() => {
    setError("");
    setInterim("");
    webSpeech.cancel();
    const handlers: ListenHandlers = {
      onInterim: setInterim,
      onFinal: (t) => {
        setState("idle");
        setInterim("");
        handle.current = null;
        if (t) onText(t);
      },
      onError: (code) => {
        setState("error");
        setInterim("");
        handle.current = null;
        setError(code === "not-allowed" ? "Microphone blocked. Allow it in the browser, or type instead." : code === "no-speech" ? "Nothing heard. Try again, or type." : "Speech recognition stopped. Try again, or type.");
      },
    };
    if (engine === "parakeet") {
      setDetail(null);
      handle.current = listenParakeet(base, handlers, { translate: opts.translate, onDetail: setDetail });
      setState("listening");
      return;
    }
    handle.current = webSpeech.listen(lang, handlers);
    if (handle.current) setState("listening");
  }, [lang, base, engine, onText, opts.translate]);

  const stop = useCallback(() => {
    const h = handle.current;
    if (!h) return;
    if (engine === "parakeet") setState("transcribing");
    h.stop();
  }, [engine]);
  const toggle = useCallback(() => (state === "listening" ? stop() : state === "transcribing" ? undefined : start()), [state, start, stop]);
  const supported = engine === "parakeet" || browserOk;
  return { state, interim, error, supported, toggle, engine, detail };
}
