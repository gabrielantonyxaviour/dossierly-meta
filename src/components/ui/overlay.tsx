"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
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

/**
 * Bottom sheet on phones, centered dialog from 720px. Closes on scrim tap and Escape; focus moves into the sheet.
 */
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  useLockAndEscape(open, onClose);
  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="ui-sheet-root">
      <div className="ui-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={id} className={`ui-sheet${wide ? " ui-sheet--wide" : ""}`}>
        <span className="ui-sheet-grip" aria-hidden="true" />
        <header className="ui-sheet-head">
          <h2 id={id}>{title}</h2>
          <IconButton icon="close" label="Close" small onClick={onClose} />
        </header>
        <div className="ui-sheet-body">{children}</div>
        {footer && <footer className="ui-sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

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
