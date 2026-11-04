"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

/** Copy-to-clipboard on the shared button (44px target), with a short confirmation. */
export function CopyValue({ text, label = "Copy" }: { text: string; label?: string }) {
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
    <Button className="lk-copy" icon={done ? "check" : "copy"} onClick={() => void copy()} aria-label={done ? "Copied" : `${label} ${text}`}>
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </Button>
  );
}
