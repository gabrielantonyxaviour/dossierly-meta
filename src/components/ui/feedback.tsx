"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { Button } from "./primitives";

/** Centered empty state with an icon tile, title, one line and an optional action. */
export function EmptyState({ icon = "sparkle", title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-state">
      <span className="ui-state-icon"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Full error state with retry. Keep `message` human: what happened and what to do. */
export function ErrorState({ title = "That didn’t load", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="ui-state ui-state--error" role="alert">
      <span className="ui-state-icon"><Icon name="alert" size={24} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && <Button size="sm" icon="refresh" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Compact inline error for forms and cards. */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="ui-inline-error" role="alert">
      <Icon name="alert" size={18} />
      <p>{message}</p>
      {onRetry && <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

type Toast = { id: number; text: string; tone: "default" | "ok" | "error"; action?: { label: string; onClick: () => void } };
type ToastCtx = { toast: (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void };
const Ctx = createContext<ToastCtx>({ toast: () => undefined });

/** Wrap the app once; call `useToast().toast("Saved")` anywhere below. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const toast = useCallback<ToastCtx["toast"]>((text, opts) => {
    const id = ++seq.current;
    setItems((old) => [...old.slice(-2), { id, text, tone: opts?.tone ?? "default", action: opts?.action }]);
    setTimeout(() => setItems((old) => old.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="ui-toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`ui-toast ui-toast--${t.tone}`}>
            {t.tone !== "default" && <Icon name={t.tone === "ok" ? "check" : "alert"} size={18} />}
            <span>{t.text}</span>
            {t.action && <button type="button" onClick={() => { t.action?.onClick(); setItems((o) => o.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);

/** Live "x ago" label that refreshes each minute. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return now;
}
