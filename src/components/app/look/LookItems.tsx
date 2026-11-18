"use client";

import { useEffect, useRef } from "react";
import type { LookItem } from "@/lib/look/types";
import { CopyValue } from "./CopyValue";
import { toneOf } from "./LookCanvas";
import { useT } from "@/lib/i18n/client";

interface Props {
  items: LookItem[];
  uncertain: string[];
  active: string | null;
  traced: Set<string>;
  onSelect(id: string | null): void;
}

/** Numbered list matching the pins on the image. Tapping a row spotlights its outline. */
export function LookItems({ items, uncertain, active, traced, onSelect }: Props) {
  const t = useT("look");
  const refs = useRef<Record<string, HTMLLIElement | null>>({});
  useEffect(() => {
    if (active) refs.current[active]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  if (!items.length) return null;
  return (
    <ol className="lk-items" aria-label={t("itemsAria")}>
      {items.map((it, n) => {
        const tone = toneOf(it.role);
        const unsure = uncertain.includes(it.id);
        return (
          <li key={it.id} ref={(el) => { refs.current[it.id] = el; }} className={`lk-item tone-${tone}${active === it.id ? " is-active" : ""}`}>
            <button type="button" className="lk-item-head" onClick={() => onSelect(active === it.id ? null : it.id)} aria-pressed={active === it.id}>
              <span className="lk-num" aria-hidden="true">{n + 1}</span>
              <span className="lk-item-label">{it.label}</span>
              {unsure && <span className="ui-pill ui-pill--warn">{t("checkThis")}</span>}
              {traced.has(it.id) && <span className="lk-traced" title={t("outlinedBy")}>{t("outlined")}</span>}
            </button>
            <blockquote className="lk-verbatim" lang="pl">{it.text}</blockquote>
            {it.meaning && <p className="lk-meaning">{it.meaning}</p>}
            {it.role === "field" && (
              <div className="lk-value">
                {it.value ? (
                  <>
                    <div className="grow">
                      <span className="tiny muted">{t("typeThis")}</span>
                      <b className="mono">{it.value}</b>
                    </div>
                    <CopyValue text={it.value} />
                  </>
                ) : (
                  <span className="small muted">{t("notInCase")}</span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
