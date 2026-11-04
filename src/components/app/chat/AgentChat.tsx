"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AgentOrb, IconButton, IconLink, Markdown, Pill } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useCaseData } from "../shell/case-data";
import { firstName } from "../format";
import { AttachSheet, findAttachment } from "./AttachSheet";
import { Composer } from "./Composer";
import { useAgentChat, type Attachment, type Msg } from "./useAgentChat";
import "./agent-chat.css";

function Suggestions({ onPick }: { onPick: (q: string, a?: Attachment[]) => void }) {
  const { snapshot, next } = useCaseData();
  const list: { q: string; a?: Attachment[] }[] = [];
  if (next) {
    const nextAttach = next.id && (next.kind === "deadline" || next.kind === "task" || next.kind === "document") ? [{ kind: next.kind, id: next.id, title: next.title }] : undefined;
    list.push({ q: `What exactly do I need to do for “${next.title}”?`, a: nextAttach });
  }
  const appt = snapshot?.appointments[0];
  if (appt) list.push({ q: `What should I bring to my ${appt.title.toLowerCase()}?`, a: [{ kind: "appointment", id: appt.id, title: appt.title }] });
  list.push({ q: "Can I travel outside Poland while I wait for my decision?" }, { q: "Explain my case status in simple words" });
  return (
    <div className="ac-suggest">
      {list.slice(0, 4).map((s) => (
        <button key={s.q} type="button" onClick={() => onPick(s.q, s.a)}><Icon name="sparkle" size={16} /><span>{s.q}</span></button>
      ))}
    </div>
  );
}

function Bubble({ m, last, onRetry }: { m: Msg; last: boolean; onRetry: () => void }) {
  if (m.role === "user") {
    return (
      <div className="ac-user">
        {m.attachments?.length ? <div className="ac-atts">{m.attachments.map((a) => <Pill key={a.id} icon="attach" tone="outline">{a.title}</Pill>)}</div> : null}
        <p>{m.content}</p>
      </div>
    );
  }
  return (
    <div className="ac-bot" aria-live={m.state === "streaming" ? "polite" : undefined} aria-busy={m.state === "streaming"}>
      <AgentOrb size={28} state={m.state === "streaming" ? "live" : "still"} />
      <div className="ac-bot-body">
        {m.content ? <Markdown text={m.content} /> : m.state === "streaming" ? <p className="ac-thinking"><span /><span /><span /><em>Reading your case…</em></p> : null}
        {m.state === "streaming" && m.content && <span className="ac-caret" aria-hidden="true" />}
        {m.sources?.length ? (
          <div className="ac-sources">
            <span className="ui-meta">Sources</span>
            {m.sources.map((s, i) => s.url ? <a key={i} href={s.url} target="_blank" rel="noreferrer"><Pill icon="external" tone="info">{s.title}</Pill></a> : <Pill key={i} icon="case">{s.title}</Pill>)}
          </div>
        ) : null}
        {(m.state === "error" || m.state === "stopped") && (
          <div className={m.state === "error" ? "ac-err" : "ac-stopped"}>
            <span>{m.state === "error" ? m.error : "Stopped."}</span>
            {last && <button type="button" onClick={onRetry}><Icon name="refresh" size={15} />Retry</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentChat() {
  const { snapshot } = useCaseData();
  const { messages, loaded, busy, send, stop, retry, clear } = useAgentChat();
  const [draft, setDraft] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [picking, setPicking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const params = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!loaded || !snapshot || handled.current) return;
    const q = params.get("q");
    if (!q) return;
    handled.current = true;
    const [kind, id] = (params.get("attach") ?? "").split(":");
    const a = kind && id ? findAttachment(snapshot, kind, id) : null;
    router.replace("/app/chat", { scroll: false });
    void send(q, a ? [a] : []);
  }, [loaded, snapshot, params, router, send]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);

  const submit = (text = draft, a = atts) => {
    if (!text.trim() || busy) return;
    setDraft(""); setAtts([]);
    void send(text, a);
  };
  const empty = loaded && messages.length === 0;
  return (
    <div className="ac">
      <header className="ac-bar">
        <IconLink href="/app" icon="back" label="Back to home" />
        <div className="ac-bar-title"><AgentOrb size={26} state="still" /><span><b>Dossierly</b><small>Knows your case · Muse Spark</small></span></div>
        <div className="ac-bar-actions">
          {messages.length > 0 && <IconButton icon="plus" label="New chat" onClick={clear} disabled={busy} />}
          <IconLink href="/app/call" icon="phone" label="Talk by voice" />
        </div>
      </header>
      <div className="ac-scroll">
        <div className="ac-thread">
          {empty && (
            <div className="ac-empty">
              <AgentOrb size={72} />
              <h1 className="ui-display">How can I help, {firstName(snapshot?.profile.fullName)}?</h1>
              <p className="ui-body">I know your case: letters, dates, documents and what was said at the counter. I explain and prepare. I never file or log in for you.</p>
              <Suggestions onPick={(q, a) => submit(q, a ?? [])} />
            </div>
          )}
          {messages.map((m, i) => <Bubble key={m.id} m={m} last={i === messages.length - 1} onRetry={() => void retry()} />)}
          <div ref={end} />
        </div>
      </div>
      <Composer value={draft} onChange={setDraft} onSubmit={() => submit()} onStop={stop} busy={busy} attachments={atts} onRemove={(id) => setAtts((a) => a.filter((x) => x.id !== id))} onAttach={() => setPicking(true)} />
      {snapshot && <AttachSheet open={picking} onClose={() => setPicking(false)} c={snapshot} selected={atts} onToggle={(a) => setAtts((old) => (old.some((x) => x.id === a.id) ? old.filter((x) => x.id !== a.id) : [...old, a].slice(0, 5)))} />}
    </div>
  );
}
