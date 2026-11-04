"use client";

import type { ReactNode } from "react";
import { MobileFlowHeader, MobilePage, StickyActionBar } from "@/components/ui";
import "./screen.css";

export interface VoiceScreenProps {
  title?: ReactNode;
  /** Close target: a route, or a handler. */
  close: string | (() => void);
  /** Right side of the top bar. */
  action?: ReactNode;
  progress?: { at: number; of: number };
  /** Sticky bottom bar content (primary button, call controls, typing field). */
  foot?: ReactNode;
  /** Secondary text action under the primary. */
  secondary?: ReactNode;
  /** Live views: the page fills the screen and scrolls inside (captions), instead of scrolling the document. */
  live?: boolean;
  /** Reserve room for a taller bar (typing field + controls). */
  tall?: boolean;
  label?: string;
  children: ReactNode;
}

/**
 * The voice flows' full-screen frame, built only from the shared mobile primitives:
 * MobileFlowHeader (close) → MobilePage → StickyActionBar. `.vs` only pins it over the app shell.
 */
export function VoiceScreen({ title, close, action, progress, foot, secondary, live, tall, label, children }: VoiceScreenProps) {
  return (
    <div className={`vs ${live ? "vs--live" : ""}`} aria-label={label}>
      <MobileFlowHeader back={close} close title={title} progress={progress} action={action} />
      <MobilePage actions={foot ? (tall ? "double" : true) : undefined} className="vs-page">{children}</MobilePage>
      {foot && <StickyActionBar secondary={secondary}>{foot}</StickyActionBar>}
    </div>
  );
}
