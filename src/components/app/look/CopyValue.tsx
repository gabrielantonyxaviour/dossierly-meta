"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

/** Copy-to-clipboard on the shared button (44px target), with a short confirmation. */
export function CopyValue({ text, label: given }: { text: string; label?: string }) {
  const t = useT("look");
  const label = given ?? t("copy");
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      setDone(false);
    }
  };
  return (
    <Button className="lk-copy" icon={done ? "check" : "copy"} onClick={() => void copy()} aria-label={done ? t("copied") : `${label} ${text}`}>
      <span aria-live="polite">{done ? t("copied") : label}</span>
    </Button>
  );
}
