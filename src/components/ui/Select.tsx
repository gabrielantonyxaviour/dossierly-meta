"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Chevron, usePopover } from "./usePopover";

export type SelectOption = { value: string; label: string; description?: string };

type Props = {
  value: string;
  onChange(value: string): void;
  options: SelectOption[];
  /** id of the visible label element; the trigger reads as "<label> <value>". */
  labelledBy?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Select({ value, onChange, options, labelledBy, id, placeholder: placeholderProp, disabled, className }: Props) {
  const t = useT("ui");
  const placeholder = placeholderProp ?? t("choose");
  const auto = useId();
  const triggerId = id ?? `sel-${auto}`;
  const listId = `${triggerId}-list`;
  const optId = (i: number) => `${triggerId}-opt-${i}`;
  const { open, show, close, placement, wrap, trigger, pop, onBlur } = usePopover();
  const list = useRef<HTMLUListElement>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));
  const typed = useRef({ text: "", at: 0 });
  const selected = options[selectedIndex];

  const openAt = (i: number) => {
    setActive(Math.min(options.length - 1, Math.max(0, i)));
    show();
  };

  useEffect(() => {
    if (open) list.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${triggerId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, triggerId]);

  const choose = (i: number) => {
    const o = options[i];
    if (o) onChange(o.value);
    close();
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 700 ? key.toLowerCase() : t.text + key.toLowerCase();
    t.at = now;
    const start = t.text.length === 1 ? active + 1 : active;
    for (let k = 0; k < options.length; k++) {
      const i = (start + k) % options.length;
      if (options[i].label.toLowerCase().startsWith(t.text)) return i;
    }
    return -1;
  };

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openAt(e.key === "ArrowUp" && selectedIndex < 0 ? options.length - 1 : selectedIndex);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeAhead(e.key);
      if (i >= 0) onChange(options[i].value);
    }
  };

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((a) => Math.min(last, a + 1)),
      ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
      Home: () => setActive(0),
      End: () => setActive(last),
      PageDown: () => setActive((a) => Math.min(last, a + 5)),
      PageUp: () => setActive((a) => Math.max(0, a - 5)),
      Enter: () => choose(active),
      " ": () => choose(active),
      Escape: () => close(),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      const i = typeAhead(e.key);
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={wrap} onBlur={onBlur} className={`ui-select${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        className="ui-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy ? `${labelledBy} ${triggerId}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openAt(selectedIndex))}
        onKeyDown={onTriggerKey}
      >
        <span className={`ui-trigger-value${selected ? "" : " is-placeholder"}`}>{selected?.label ?? placeholder}</span>
        <Chevron />
      </button>
      {open && (
        <>
          {placement === "sheet" && <div className="ui-backdrop" aria-hidden="true" onClick={() => close()} />}
          <div ref={pop} className={`ui-pop ui-pop-${placement}`}>
            {placement === "sheet" && <div className="ui-sheet-grip" aria-hidden="true" />}
            <ul
              ref={list}
              id={listId}
              role="listbox"
              tabIndex={-1}
              className="ui-listbox"
              aria-labelledby={labelledBy}
              aria-activedescendant={optId(active)}
              onKeyDown={onListKey}
            >
              {options.map((o, i) => (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={o.value === value}
                  className={`ui-option${i === active ? " is-active" : ""}`}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => choose(i)}
                >
                  <span className="ui-option-text">
                    <span className="ui-option-label">{o.label}</span>
                    {o.description && <span className="ui-option-desc">{o.description}</span>}
                  </span>
                  <svg className="ui-option-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
