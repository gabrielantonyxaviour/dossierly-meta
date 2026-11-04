"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconLink } from "./primitives";

/**
 * Page header: sticky glass bar (back + trailing actions) above a large title. When the large title scrolls
 * away, a compact title fades into the bar (iOS large-title pattern).
 */
export function TopBar({ title, eyebrow, back, actions, sub, large = true }: { title: ReactNode; eyebrow?: ReactNode; back?: { href: string; label: string }; actions?: ReactNode; sub?: ReactNode; large?: boolean }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(!large);
  useEffect(() => {
    if (!large || !sentinel.current) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [large]);
  return (
    <>
      <div className={`ui-topbar${compact ? " is-compact" : ""}`}>
        <div className="ui-topbar-lead">{back && <IconLink href={back.href} icon="back" label={back.label} />}</div>
        <div className="ui-topbar-title" aria-hidden={large ? !compact : undefined}>{title}</div>
        <div className="ui-topbar-actions">{actions}</div>
      </div>
      {large && (
        <div className="ui-largetitle" ref={sentinel}>
          {eyebrow && <div className="ui-largetitle-eyebrow">{eyebrow}</div>}
          <h1 className="ui-display">{title}</h1>
          {sub && <div className="ui-largetitle-sub">{sub}</div>}
        </div>
      )}
    </>
  );
}
