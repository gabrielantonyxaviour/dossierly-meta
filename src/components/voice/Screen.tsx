"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "@/components/ui";
import { Icon } from "../Icon";
import "./screen.css";

/** Keeps the bottom bar above the on-screen keyboard: --kb is the part of the layout viewport the keyboard covers. */
function useKeyboardInset(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => ref.current?.style.setProperty("--kb", `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [ref]);
}

export interface VoiceScreenProps {
  title?: ReactNode;
  /** Close target: a route, or a handler. */
  close: string | (() => void);
  closeLabel?: string;
  /** Right side of the top bar (a pill or one small control). */
  end?: ReactNode;
  /** Thin progress under the bar, 0–1. */
  progress?: number;
  /** Bottom action bar (thumb zone): primary button, call controls, a typing field. */
  foot?: ReactNode;
  /** Centre the body content vertically (start and feedback screens). */
  center?: boolean;
  label?: string;
  children: ReactNode;
}

/**
 * Full-screen phone layout for the voice flows: compact top bar (close, title, one action), a scrolling body with the
 * 16px gutter and safe areas, and a bottom bar that stays above the keyboard. Desktop keeps a centred column.
 */
export function VoiceScreen({ title, close, closeLabel = "Close", end, progress, foot, center, label, children }: VoiceScreenProps) {
  const ref = useRef<HTMLDivElement>(null);
  useKeyboardInset(ref);
  return (
    <div className="vs" ref={ref} aria-label={label}>
      <header className="vs-bar">
        {typeof close === "string" ? (
          <Link href={close} className="ui-icon-btn" aria-label={closeLabel} title={closeLabel}><Icon name="close" size={22} /></Link>
        ) : (
          <IconButton icon="close" label={closeLabel} onClick={close} />
        )}
        <div className="vs-title">{title}</div>
        <div className="vs-end">{end}</div>
        {typeof progress === "number" && (
          <div className="vs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${Math.min(1, Math.max(0, progress)) * 100}%` }} />
          </div>
        )}
      </header>
      <div className={`vs-body ${center ? "is-center" : ""}`}>{children}</div>
      {foot && <footer className="vs-foot">{foot}</footer>}
    </div>
  );
}
