"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import { Icon } from "./Icon";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useT("ui");
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className="btn btn-small" onClick={() => void copy()} aria-live="polite">
      <Icon name={done ? "check" : "copy"} size={18} />
      {done ? t("copied") : label ?? t("copy")}
    </button>
  );
}
