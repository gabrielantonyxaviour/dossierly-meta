import type { ApiFailure } from "@/lib/client/api";
import { friendlyError } from "@/lib/client/api";

export function Loading({ label }: { label: string }) {
  return (
    <div className="row muted" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ failure, onRetry }: { failure: ApiFailure | string; onRetry?: () => void }) {
  const text = typeof failure === "string" ? failure : friendlyError(failure);
  return (
    <div className="error-box stack" role="alert" style={{ ["--gap" as string]: "10px" }}>
      <p style={{ margin: 0 }}>{text}</p>
      <div className="row">
        {onRetry && <button className="btn btn-small" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}
