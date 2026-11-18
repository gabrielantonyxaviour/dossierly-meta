"use client";

import { useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { Icon } from "../Icon";

type Props = {
  /** Same syntax as the input accept attribute, e.g. "application/pdf,image/*". */
  accept: string;
  onFile(file: File): void;
  /** Short line under the main prompt, e.g. "PDF or photo, up to 4 pages". */
  hint?: string;
  /** Prompt on phones, where there is nothing to drag. */
  compactLabel?: string;
  /** What the accepted types are, in words, for the wrong-type message. */
  kinds?: string;
  disabled?: boolean;
  className?: string;
};

const matches = (file: File, accept: string) =>
  accept.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean).some((a) =>
    a.startsWith(".") ? file.name.toLowerCase().endsWith(a) : a.endsWith("/*") ? file.type.startsWith(a.slice(0, -1)) : file.type === a,
  );

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Dropzone({ accept, onFile, hint, compactLabel: compactProp, kinds: kindsProp, disabled, className }: Props) {
  const t = useT("ui");
  const compactLabel = compactProp ?? t("dropCompact");
  const kinds = kindsProp ?? t("dropKinds");
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const hintId = useId();
  const [over, setOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = (f?: File | null) => {
    if (!f) return;
    if (!matches(f, accept)) {
      setError(t("wrongType", { name: f.name, kinds }));
      return;
    }
    setError(null);
    setFile(f);
    onFile(f);
  };

  const clear = () => {
    setFile(null);
    setError(null);
    if (input.current) input.current.value = "";
  };

  const onDrag = (e: React.DragEvent, kind: "enter" | "over" | "leave") => {
    e.preventDefault();
    if (disabled) return;
    if (kind === "enter") depth.current += 1;
    if (kind === "leave") depth.current = Math.max(0, depth.current - 1);
    if (kind === "over") e.dataTransfer.dropEffect = "copy";
    setOver(depth.current > 0);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (!disabled) take(e.dataTransfer.files?.[0]);
  };

  return (
    <div className={`ui-drop-wrap${className ? ` ${className}` : ""}`}>
      {file ? (
        <div className="ui-file-row">
          <span className="ui-file-icon" aria-hidden="true"><Icon name="file" size={20} /></span>
          <span className="ui-file-text">
            <span className="ui-file-name">{file.name}</span>
            <span className="ui-file-size">{formatBytes(file.size)}</span>
          </span>
          <button type="button" className="ui-file-remove" onClick={clear} disabled={disabled} aria-label={t("removeFile", { name: file.name })}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`ui-drop${over ? " is-over" : ""}`}
          onClick={() => input.current?.click()}
          onDragEnter={(e) => onDrag(e, "enter")}
          onDragOver={(e) => onDrag(e, "over")}
          onDragLeave={(e) => onDrag(e, "leave")}
          onDrop={onDrop}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
        >
          <span className="ui-drop-icon" aria-hidden="true"><Icon name="file" size={24} /></span>
          <span className="ui-drop-title ui-drop-wide">
            {over ? t("dropOver") : rich(t("dropWide"), { choose: <u>{t("chooseFile")}</u> })}
          </span>
          <span className="ui-drop-title ui-drop-narrow">{compactLabel}</span>
          {hint && <span id={hintId} className="ui-drop-hint">{hint}</span>}
        </button>
      )}
      {error && <p className="ui-drop-error" role="alert">{error}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => take(e.target.files?.[0])}
      />
    </div>
  );
}
