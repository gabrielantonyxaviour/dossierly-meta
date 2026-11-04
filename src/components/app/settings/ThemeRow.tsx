"use client";
import { useState } from "react";
import { Row } from "@/components/ui";

type Theme = "system" | "light" | "dark";
const KEY = "dossierly:theme";

function apply(t: Theme) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage blocked: applies to this visit */ }
}

/** System / Light / Dark appearance switch. The root layout applies the saved choice before paint. */
export function ThemeRow() {
  const [t, setT] = useState<Theme>(() => {
    try { const v = typeof window === "undefined" ? null : localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
  });
  const pick = (v: Theme) => { setT(v); apply(v); };
  return (
    <Row icon="moon" title="Appearance" end={
      <div className="ui-seg st-theme" role="radiogroup" aria-label="Appearance">
        {(["system", "light", "dark"] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={t === v} onClick={() => pick(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
        ))}
      </div>
    } />
  );
}
