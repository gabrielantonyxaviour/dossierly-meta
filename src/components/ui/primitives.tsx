import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "../Icon";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "agent";
type Size = "sm" | "md" | "lg";
type BtnBase = { variant?: Variant; size?: Size; block?: boolean; icon?: IconName; iconEnd?: IconName; loading?: boolean; children?: ReactNode };
const btnClass = ({ variant = "soft", size = "md", block }: BtnBase, extra?: string) =>
  cx("ui-btn", variant !== "soft" && `ui-btn--${variant}`, size !== "md" && `ui-btn--${size}`, block && "ui-btn--block", extra);

function BtnInner({ icon, iconEnd, loading, children, size }: BtnBase) {
  const s = size === "sm" ? 16 : 19;
  return <>{loading ? <span className="ui-spin" aria-hidden="true" /> : icon && <Icon name={icon} size={s} />}{children}{iconEnd && <Icon name={iconEnd} size={s} />}</>;
}

/** Pill button. `variant`: primary (ink), secondary (card), soft (default), ghost, danger, agent (signature gradient). */
export function Button({ variant, size, block, icon, iconEnd, loading, className, children, ...rest }: BtnBase & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type="button" className={btnClass({ variant, size, block }, className)} aria-busy={loading || undefined} {...rest}>
      <BtnInner {...{ icon, iconEnd, loading, size }}>{children}</BtnInner>
    </button>
  );
}

/** Same look as Button, rendered as a Next link. */
export function ButtonLink({ variant, size, block, icon, iconEnd, className, children, ...rest }: BtnBase & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link className={btnClass({ variant, size, block }, className)} {...rest}>
      <BtnInner {...{ icon, iconEnd, size }}>{children}</BtnInner>
    </Link>
  );
}

type IconBtnBase = { icon: IconName; label: string; filled?: boolean; small?: boolean; dot?: boolean };
/** 44px round icon-only control. `label` is required for screen readers. */
export function IconButton({ icon, label, filled, small, dot, className, ...rest }: IconBtnBase & Omit<ComponentProps<"button">, "children">) {
  return (
    <button type="button" aria-label={label} title={label} className={cx("ui-icon-btn", filled && "ui-icon-btn--filled", small && "ui-icon-btn--sm", className)} {...rest}>
      <Icon name={icon} size={small ? 18 : 22} />
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
    </button>
  );
}
export function IconLink({ icon, label, filled, small, dot, className, ...rest }: IconBtnBase & Omit<ComponentProps<typeof Link>, "children">) {
  return (
    <Link aria-label={label} title={label} className={cx("ui-icon-btn", filled && "ui-icon-btn--filled", small && "ui-icon-btn--sm", className)} {...rest}>
      <Icon name={icon} size={small ? 18 : 22} />
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
    </Link>
  );
}

export function Card({ className, flush, raised, ...rest }: ComponentProps<"div"> & { flush?: boolean; raised?: boolean }) {
  return <div className={cx("ui-card", flush && "ui-card--flush", raised && "ui-card--raised", className)} {...rest} />;
}
export function CardLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cx("ui-card ui-card--link", className)} {...rest} />;
}

export type Tone = "neutral" | "deadline" | "ok" | "warn" | "official" | "info" | "agent" | "outline";
/** Status pill. Red (`deadline`) is reserved for deadlines and overdue items. */
export function Pill({ tone = "neutral", dot, icon, children, className }: { tone?: Tone; dot?: boolean; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cx("ui-pill", tone !== "neutral" && `ui-pill--${tone}`, className)}>
      {dot && <span className="ui-dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  const initials = (name ?? "").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "·";
  return <span className="ui-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">{initials}</span>;
}

export function Skeleton({ h = 18, w = "100%", r, className }: { h?: number; w?: number | string; r?: number; className?: string }) {
  return <span className={cx("ui-skel", className)} style={{ display: "block", height: h, width: w, borderRadius: r }} aria-hidden="true" />;
}

export function Spinner({ label }: { label?: string }) {
  return <span className="ui-spin" role={label ? "status" : undefined} aria-label={label} />;
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ui-switch" onClick={() => onChange(!checked)} />;
}

/** Round task checkbox. */
export function CheckCircle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled} className="ui-check" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}>
      <Icon name="check" size={15} />
    </button>
  );
}

export { cx };
