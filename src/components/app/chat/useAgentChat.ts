"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Attachment = { kind: "deadline" | "document" | "event" | "task" | "appointment"; id: string; title: string };
export type Source = { title: string; url: string; kind: "case" | "web" };
export type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  sources?: Source[];
  state?: "streaming" | "done" | "error" | "stopped";
  error?: string;
};

export const CHAT_KEY = "dossierly:chat:v1";
const load = (): Msg[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAT_KEY) ?? "[]") as Msg[];
    return Array.isArray(raw) ? raw.map((m) => (m.state === "streaming" ? { ...m, state: "stopped" as const } : m)) : [];
  } catch { return []; }
};
const save = (m: Msg[]) => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(m.slice(-60))); } catch { /* storage blocked: chat lives for this tab only */ } };

function friendly(status: number, body: { error?: string; code?: string }): string {
  if (status === 0) return "You seem to be offline. Check your connection and retry.";
  if (body.code === "over_budget") return "Today’s usage limit is reached. Try again tomorrow.";
  if (status === 429) return "Lots of requests just now. Wait a few seconds and retry.";
  if (body.code === "models_disabled" || body.code === "no_key") return "Dossierly’s model is paused right now. Try again shortly.";
  return body.error || "Something went wrong. Retry.";
}

/** Streaming chat with the case-grounded agent (POST /api/chat, SSE). Persists the thread on this device. */
export function useAgentChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<Msg[]>([]);
  const abort = useRef<AbortController | null>(null);
  const set = useCallback((fn: (m: Msg[]) => Msg[]) => { const next = fn(ref.current); ref.current = next; setMessages(next); save(next); }, []);
  useEffect(() => { ref.current = load(); setMessages(ref.current); setLoaded(true); return () => abort.current?.abort(); }, []);

  const busy = messages.some((m) => m.state === "streaming");

  const run = useCallback(async (history: Msg[], attachments: Attachment[]) => {
    const aid = crypto.randomUUID();
    set((m) => [...m, { id: aid, role: "assistant", content: "", state: "streaming" }]);
    const patch = (p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) => set((all) => all.map((x) => (x.id === aid ? { ...x, ...(typeof p === "function" ? p(x) : p) } : x)));
    const ctl = new AbortController();
    abort.current = ctl;
    const payload = {
      messages: history.filter((m) => m.content.trim() && m.state !== "error").slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
      attachments: attachments.map(({ kind, id }) => ({ kind, id })),
    };
    let res: Response;
    try {
      res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal });
    } catch {
      if (ctl.signal.aborted) return patch({ state: "stopped" });
      return patch({ state: "error", error: friendly(0, {}) });
    }
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      return patch({ state: "error", error: friendly(res.status, body) });
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
          if (!data) continue;
          let ev: { type: string; text?: string; items?: Source[]; error?: string; code?: string };
          try { ev = JSON.parse(data); } catch { continue; }
          if (ev.type === "delta" && ev.text) patch((m) => ({ content: m.content + ev.text }));
          else if (ev.type === "sources" && ev.items) patch({ sources: ev.items });
          else if (ev.type === "error") patch({ state: "error", error: friendly(500, ev) });
          else if (ev.type === "done") patch((m) => (m.state === "streaming" ? { state: "done" } : {}));
        }
      }
      patch((m) => (m.state === "streaming" ? { state: m.content ? "done" : "error", error: m.content ? undefined : "The answer was empty. Retry." } : {}));
    } catch {
      patch({ state: ctl.signal.aborted ? "stopped" : "error", error: ctl.signal.aborted ? undefined : "The connection dropped mid-answer. Retry." });
    } finally {
      if (abort.current === ctl) abort.current = null;
    }
  }, [set]);

  const send = useCallback(async (text: string, attachments: Attachment[] = []) => {
    const content = text.trim().slice(0, 4000);
    if (!content || ref.current.some((m) => m.state === "streaming")) return;
    const user: Msg = { id: crypto.randomUUID(), role: "user", content, attachments: attachments.length ? attachments : undefined };
    set((m) => [...m, user]);
    await run(ref.current, attachments);
  }, [run, set]);

  const stop = useCallback(() => abort.current?.abort(), []);

  /** Re-asks the last user message, replacing the failed/stopped answer. */
  const retry = useCallback(async () => {
    const all = ref.current;
    const lastUser = [...all].reverse().find((m) => m.role === "user");
    if (!lastUser || all.some((m) => m.state === "streaming")) return;
    const cut = all.slice(0, all.lastIndexOf(lastUser) + 1);
    set(() => cut);
    await run(cut, lastUser.attachments ?? []);
  }, [run, set]);

  const clear = useCallback(() => { abort.current?.abort(); set(() => []); }, [set]);

  return { messages, loaded, busy, send, stop, retry, clear };
}
