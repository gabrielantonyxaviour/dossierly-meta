"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/client/api";
import { useCase } from "@/lib/client/store";
import { Icon } from "../Icon";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "D";
}

/** The one identity block: who this case is for, the plan, and the account menu. */
export function IdentityMenu({ compact = false }: { compact?: boolean }) {
  const { dossier } = useCase();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = dossier?.case.profile.name ?? "Your case";
  const sub = dossier?.sample ? "Sample case" : "Your case";

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const leave = async () => {
    await signOut();
    window.location.assign("/");
  };

  return (
    <div className={`idm${compact ? " is-compact" : ""}`} ref={ref}>
      <button className="idm-trigger" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <span className="idm-avatar" aria-hidden="true">{initials(name)}</span>
        {!compact && (
          <>
            <span className="idm-text"><b>{name}</b><small>{sub}</small></span>
            <Icon name="chevron" size={16} />
          </>
        )}
      </button>
      {open && (
        <div className="idm-menu" role="menu">
          {compact && <div className="idm-head"><b>{name}</b><small>{sub}</small></div>}
          <Link role="menuitem" href="/app/help" onClick={() => setOpen(false)}><Icon name="help" size={18} />Help</Link>
          <Link role="menuitem" href="/" onClick={() => setOpen(false)}><Icon name="globe" size={18} />Website</Link>
          <hr />
          <button role="menuitem" onClick={() => void leave()}><Icon name="out" size={18} />Sign out</button>
        </div>
      )}
    </div>
  );
}
