"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Chevron, usePopover } from "./usePopover";
import type { SelectOption } from "./Select";

type Props = {
  value: string;
  onChange(value: string): void;
  options: SelectOption[];
  /** id of the visible label element. */
  labelledBy?: string;
  id?: string;
  placeholder?: string;
  /** Lets the person use what they typed when no option matches (e.g. a smaller town). */
  allowCustom?: boolean;
  /** Shown for a custom value; defaults to the value itself. */
  customLabel?: (typed: string) => string;
  disabled?: boolean;
  className?: string;
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();

/**
 * Searchable select: the Select trigger and popover (a bottom sheet on phones) with a search field over the list.
 * Matching ignores Polish diacritics, so "lodz" finds "Łódź". Keyboard: type, ArrowUp/Down, Enter, Escape.
 */
export function Combobox({ value, onChange, options, labelledBy, id, placeholder: ph, allowCustom, customLabel, disabled, className }: Props) {
  const t = useT("ui");
  const auto = useId();
  const triggerId = id ?? `cb-${auto}`;
  const listId = `${triggerId}-list`;
  const { open, show, close, placement, wrap, trigger, pop, onBlur } = usePopover();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const f = fold(q.trim());
    const hits = f ? options.filter((o) => fold(o.label).includes(f)) : options;
    const custom = allowCustom && q.trim().length > 1 && !options.some((o) => fold(o.label) === f) ? [{ value: q.trim(), label: customLabel?.(q.trim()) ?? q.trim() }] : [];
    return [...hits, ...custom];
  }, [q, options, allowCustom, customLabel]);

  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (open) document.getElementById(`${triggerId}-opt-${active}`)?.scrollIntoView({ block: "nearest" }); }, [open, active, triggerId]);

  const openList = () => { setQ(""); setActive(Math.max(0, options.findIndex((o) => o.value === value))); show(); };
  const choose = (i: number) => { const o = shown[i]; if (o) onChange(o.value); close(); };
  const onKey = (e: React.KeyboardEvent) => {
    const last = shown.length - 1;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close(false);
  };
  const label = selected?.label ?? (allowCustom && value ? customLabel?.(value) ?? value : undefined);

  return (
    <div ref={wrap} onBlur={onBlur} className={`ui-select${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button ref={trigger} id={triggerId} type="button" className="ui-trigger" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-labelledby={labelledBy ? `${labelledBy} ${triggerId}` : undefined} disabled={disabled}
        onClick={() => (open ? close() : openList())} onKeyDown={(e) => { if (["ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); openList(); } }}>
        <span className={`ui-trigger-value${label ? "" : " is-placeholder"}`}>{label ?? ph ?? t("choose")}</span>
        <Chevron />
      </button>
      {open && (
        <>
          {placement === "sheet" && <div className="ui-backdrop" aria-hidden="true" onClick={() => close()} />}
          <div ref={pop} className={`ui-pop ui-pop-${placement} ui-combo-pop`}>
            {placement === "sheet" && <div className="ui-sheet-grip" aria-hidden="true" />}
            <input ref={input} className="input ui-combo-search" type="text" role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={shown.length ? `${triggerId}-opt-${active}` : undefined} aria-label={t("search")} placeholder={t("search")}
              value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} autoComplete="off" />
            <ul id={listId} role="listbox" className="ui-listbox" aria-labelledby={labelledBy}>
              {shown.map((o, i) => (
                <li key={`${o.value}-${i}`} id={`${triggerId}-opt-${i}`} role="option" aria-selected={o.value === value}
                  className={`ui-option${i === active ? " is-active" : ""}`} onPointerMove={() => i !== active && setActive(i)} onClick={() => choose(i)}>
                  <span className="ui-option-text"><span className="ui-option-label">{o.label}</span></span>
                  <svg className="ui-option-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </li>
              ))}
              {!shown.length && <li className="ui-option ui-combo-empty" role="presentation">{t("noMatches")}</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
