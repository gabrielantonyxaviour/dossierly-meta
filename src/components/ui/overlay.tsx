"use client";
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from "react";
import { IconButton } from "./primitives";

function useLockAndEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", key); };
  }, [open, onClose]);
}

/** Drag the grip/header down to dismiss (phones). Releases past 96px or a quick flick close the sheet. */
function useDragDismiss(onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; t: number } | null>(null);
  const set = (dy: number) => { if (panel.current) panel.current.style.transform = dy ? `translateY(${dy}px)` : ""; };
  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (window.matchMedia("(min-width: 768px)").matches || (e.target as HTMLElement).closest("button")) return;
      start.current = { y: e.clientY, t: performance.now() };
      e.currentTarget.setPointerCapture(e.pointerId);
      panel.current?.classList.add("is-dragging");
    },
    onPointerMove(e: PointerEvent<HTMLElement>) { if (start.current) set(Math.max(0, e.clientY - start.current.y)); },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      if (!s || !panel.current) return;
      const dy = e.clientY - s.y;
      const fast = dy / Math.max(1, performance.now() - s.t) > 0.6;
      panel.current.classList.remove("is-dragging");
      if (dy > 96 || (fast && dy > 24)) return onClose();
      panel.current.classList.add("is-settling");
      set(0);
      window.setTimeout(() => panel.current?.classList.remove("is-settling"), 220);
    },
  };
  return { panel, handlers };
}

/**
 * Bottom sheet on phones (drag handle, safe-area bottom, drag down to dismiss), centered dialog from 768px.
 * Closes on scrim tap and Escape; focus moves into the sheet. Use for secondary choices and confirmations.
 */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  const { panel, handlers: drag } = useDragDismiss(onClose);
  useLockAndEscape(open, onClose);
  useEffect(() => { if (open) panel.current?.focus(); }, [open, panel]);
  if (!open) return null;
  return (
    <div className="ui-sheet-root">
      <div className="ui-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={`ui-sheet${wide ? " ui-sheet--wide" : ""}`}>
        <div className="ui-sheet-drag" {...drag} onPointerCancel={drag.onPointerUp}>
          <span className="ui-sheet-grip" aria-hidden="true" />
          <header className="ui-sheet-head">
            <h2 id={id}>{title}</h2>
            <IconButton icon="close" label="Close" small onClick={onClose} />
          </header>
        </div>
        <div className="ui-sheet-body">{children}</div>
        {footer && <footer className="ui-sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** The standard's name for Sheet. */
export const BottomSheet = Sheet;

/**
 * Full-screen modal flow (camera, counter, guided steps). Own top bar with close; content scrolls; optional
 * sticky footer for the primary action. Use for any flow that should hide the app's navigation.
 */
export function FullScreenFlow({ title, onClose, children, footer, step, dark }: { title?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; step?: { at: number; of: number }; dark?: boolean }) {
  useLockAndEscape(true, onClose);
  return (
    <div className={`ui-flow${dark ? " ui-flow--dark" : ""}`} role="dialog" aria-modal="true">
      <header className="ui-flow-bar">
        <IconButton icon="close" label="Close" onClick={onClose} />
        <div className="ui-flow-title">{title}</div>
        <span style={{ width: 44 }} />
        {step && <div className="ui-flow-progress" aria-label={`Step ${step.at} of ${step.of}`}><span style={{ width: `${(step.at / step.of) * 100}%` }} /></div>}
      </header>
      <div className="ui-flow-body">{children}</div>
      {footer && <footer className="ui-flow-foot">{footer}</footer>}
    </div>
  );
}
