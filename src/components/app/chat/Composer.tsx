"use client";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import type { Attachment } from "./useAgentChat";

/** ChatGPT-style composer: attachments row, auto-growing textarea, attach + send/stop. Enter sends, Shift+Enter breaks. */
export function Composer({ value, onChange, onSubmit, onStop, busy, attachments, onRemove, onAttach }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onStop: () => void; busy: boolean;
  attachments: Attachment[]; onRemove: (id: string) => void; onAttach: () => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);
  return (
    <form className="ac-composer" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="ac-box">
        {attachments.length > 0 && (
          <div className="ac-box-atts">
            {attachments.map((a) => (
              <span key={a.id} className="ac-chip">
                <Icon name="attach" size={14} /><span>{a.title}</span>
                <button type="button" aria-label={`Remove ${a.title}`} onClick={() => onRemove(a.id)}><Icon name="close" size={13} /></button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={ta} rows={1} value={value} maxLength={4000} aria-label="Message Dossierly" placeholder="Ask about your case…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSubmit(); } }}
        />
        <div className="ac-box-row">
          <button type="button" className="ac-tool" onClick={onAttach} aria-label="Attach from your case"><Icon name="plus" size={20} /><span>Case</span></button>
          <span style={{ flex: 1 }} />
          {busy
            ? <button type="button" className="ac-send ac-send--stop" onClick={onStop} aria-label="Stop answering"><Icon name="stop" size={16} /></button>
            : <button type="submit" className="ac-send" disabled={!value.trim()} aria-label="Send"><Icon name="send" size={19} /></button>}
        </div>
      </div>
      <p className="ac-fine">Dossierly explains and organises. It isn’t legal advice.</p>
    </form>
  );
}
