"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { loadDoc, saveDoc } from "@/lib/vault";
import { useCase, useDossier } from "@/lib/client/store";
import { askAgent, AskAnswerSchema, observeAgentTask, stopAgent, type AskAnswer } from "@/lib/client/onboarding-agent";
import { operationError, requireResult } from "@/lib/client/onboarding-api";
import type { Case } from "@/lib/client/types";
import { useT } from "@/lib/i18n/client";

type Message = { id: string; question: string; sourceId: string | null; taskId: string | null; state: "sending" | "queued" | "running" | "done" | "failed" | "stopped"; answer?: AskAnswer; error?: string };
type Chat = { draft: string; pasted: boolean; reviewing: boolean; sourceId: string | null; messages: Message[] };
const fresh = (): Chat => ({ draft: "", pasted: false, reviewing: false, sourceId: null, messages: [] });
export function useCaseChat() {
  const t = useT("chat");
  const dossier = useDossier(); const { me } = useCase();
  const [chat, setChat] = useState<Chat>(fresh); const [loaded, setLoaded] = useState(false); const [error, setError] = useState("");
  const current = useRef(chat); const queue = useRef(Promise.resolve()); const abort = useRef<AbortController | null>(null); const watching = useRef("");
  const key = `chat:${dossier.case.id}`;
  const update = (fn: (old: Chat) => Chat) => {
    const next = fn(current.current); current.current = next; setChat(next);
    if (me) { queue.current = queue.current.catch(() => undefined).then(() => saveDoc(key, next, me.accountId)); void queue.current.catch(() => setError(t("ccSaveFail"))); }
  };
  useEffect(() => {
    if (!me) return; let live = true;
    void loadDoc<Chat>(key, me.accountId).then((saved) => {
      if (!live) return;
      const valid = saved && typeof saved.draft === "string" && Array.isArray(saved.messages);
      const next = valid ? { ...saved, messages: saved.messages.map((m) => m.state === "sending" && !m.taskId ? { ...m, state: "failed" as const, error: t("ccInterrupted") } : m) } : fresh();
      current.current = next; setChat(next); setLoaded(true);
    }).catch(() => setError(t("ccOpenFail")));
    return () => { live = false; abort.current?.abort(); watching.current = ""; };
  }, [key, me, t]);
  const active = chat.messages.find((m) => m.state === "sending" || m.state === "queued" || m.state === "running");
  useEffect(() => {
    if (!loaded || !active?.taskId || watching.current === active.taskId) return;
    const id = active.id; const taskId = active.taskId; watching.current = taskId;
    const controller = new AbortController(); abort.current = controller;
    void observeAgentTask(taskId, (task) => { if (!controller.signal.aborted && (task.status === "queued" || task.status === "running")) update((old) => ({ ...old, messages: old.messages.map((m) => m.id === id ? { ...m, state: task.status as "queued" | "running" } : m) })); }, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!result.ok || result.data.status !== "done") { const failure = result.ok ? result.data.error || t("ccNotFinished") : result.error; update((old) => ({ ...old, messages: old.messages.map((m) => m.id === id ? { ...m, state: "failed", error: failure } : m) })); return; }
      const parsed = AskAnswerSchema.safeParse(result.data.result);
      update((old) => ({ ...old, messages: old.messages.map((m) => m.id === id ? parsed.success ? { ...m, state: "done", answer: parsed.data } : { ...m, state: "failed", error: t("ccUnsafe") } : m) }));
    });
    // The stored task id owns this subscription; snapshots must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, active?.taskId]);
  function caseContext(sourceId: string | null): Case {
    const source = dossier.letters.find((letter) => letter.id === sourceId);
    if (!source?.extracted) return dossier.case;
    const event = { id: `context-${source.id}`.slice(0, 80), date: source.deliveryDate, kind: "letter" as const, title: source.title.slice(0, 200), summary: `${source.extracted.asks.join("\n")}\n${source.extracted.transcript}`.slice(0, 1500), refs: [source.id] };
    return { ...dossier.case, events: [...dossier.case.events, event].slice(-60) };
  }
  async function send(question = current.current.draft, sourceId = current.current.sourceId) {
    if (active) return;
    const parsed = z.string().trim().min(1).max(1500).safeParse(question);
    if (!parsed.success) { setError(t("ccTooLong")); return; }
    const message: Message = { id: crypto.randomUUID(), question: parsed.data, sourceId, taskId: null, state: "sending" };
    setError(""); update((old) => ({ ...old, draft: "", reviewing: false, pasted: false, messages: [...old.messages, message].slice(-60) }));
    try { await queue.current; const receipt = requireResult(await askAgent(message.question, caseContext(sourceId), dossier.case.profile.language)); update((old) => ({ ...old, messages: old.messages.map((m) => m.id === message.id ? { ...m, taskId: receipt.taskId, state: "queued" } : m) })); }
    catch (e) { update((old) => ({ ...old, messages: old.messages.map((m) => m.id === message.id ? { ...m, state: "failed", error: operationError(e) } : m) })); }
  }
  async function stop() {
    if (!active?.taskId) return;
    try { requireResult(await stopAgent(active.taskId)); abort.current?.abort(); update((old) => ({ ...old, messages: old.messages.map((m) => m.id === active.id ? { ...m, state: "stopped", error: t("ccStoppedNote") } : m) })); }
    catch (e) { setError(operationError(e)); }
  }
  return { chat, loaded, error, active, sources: dossier.letters.filter((letter) => letter.extracted), update, send, stop, setError };
}
