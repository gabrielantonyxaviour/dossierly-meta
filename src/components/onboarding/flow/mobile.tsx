"use client";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/Logo";
import { IconButton } from "@/components/ui";

/**
 * Phone-first building blocks for onboarding (until the shared MobileFlowHeader / StickyActionBar / OptionList land
 * on main): a compact top bar with back + thin progress, a bottom action bar that rides above the keyboard, and
 * full-width option rows or 2-column tiles instead of wrapping pills.
 */
export function FlowHeader({ title, progress, onBack, disabled }: { title: string; progress: number | null; onBack?: () => void; disabled?: boolean }) {
  return (
    <header className="ob-top">
      <div className="ob-top-row">
        {onBack ? <IconButton icon="back" label="Back" onClick={onBack} disabled={disabled} />
          : <Link href="/" prefetch={false} className="ob-top-home" aria-label="Dossierly home"><LogoMark size={22} /></Link>}
        <span className="ob-top-title">{title}</span>
        <span className="ob-top-end" aria-hidden="true" />
      </div>
      {progress !== null && (
        <div className="ob-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ transform: `scaleX(${Math.max(0.04, progress)})` }} />
        </div>
      )}
    </header>
  );
}

/** Primary action (and an optional text action) pinned to the bottom of the screen, above the keyboard and home bar. */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return <div className="ob-bar"><div className="ob-bar-in">{note && <div className="ob-bar-note">{note}</div>}{children}</div></div>;
}

export type Option<T extends string> = { value: T; title: string; hint?: string; lang?: string; wide?: boolean };

/** Single choice as full-width rows (list) or equal 2-column tiles (grid). */
export function OptionList<T extends string>({ label, options, value, onChange, layout = "list", disabled }: { label: string; options: Option<T>[]; value: T | null; onChange(v: T): void; layout?: "list" | "grid"; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className={layout === "grid" ? "ob-tiles" : "ob-opts"}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={layout === "grid" ? "ob-tile" : "ob-opt"} data-wide={o.wide || undefined} disabled={disabled} onClick={() => onChange(o.value)}>
          <span className="ob-opt-text"><strong lang={o.lang}>{o.title}</strong>{o.hint && <span>{o.hint}</span>}</span>
          <span className="ob-opt-check" aria-hidden="true"><Icon name="check" size={14} /></span>
        </button>
      ))}
    </div>
  );
}

/**
 * Keeps the action bar above the on-screen keyboard: iOS (and Android without resizes-content) shrink only the
 * visual viewport, so the bar is lifted by the difference. The focused field is scrolled into view once on open.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let open = false;
    const update = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty("--ob-kb", `${kb}px`);
      root.toggleAttribute("data-kb", kb > 80);
      const el = document.activeElement;
      if (kb > 80 && !open && el instanceof HTMLElement && el.matches("input, textarea")) el.scrollIntoView({ block: "center" });
      open = kb > 80;
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--ob-kb");
      root.removeAttribute("data-kb");
    };
  }, []);
}
