import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "./primitives";

/** A titled group: heading row with optional action link, then content (usually a flush Card holding Rows). */
export function Section({ title, action, children, className, id }: { title: ReactNode; action?: { label: string; href?: string; onClick?: () => void }; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={cx("ui-section", className)} aria-labelledby={id}>
      <div className="ui-section-head">
        <h2 id={id}>{title}</h2>
        {action && (action.href ? <Link href={action.href}>{action.label}</Link> : <button type="button" onClick={action.onClick}>{action.label}</button>)}
      </div>
      {children}
    </section>
  );
}

type RowProps = {
  title: ReactNode;
  sub?: ReactNode;
  icon?: IconName | ReactNode;
  /** Colour for the icon tile, e.g. "var(--deadline-soft)". */
  iconBg?: string;
  iconColor?: string;
  end?: ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
};

/** iOS-style list row: icon tile, title + subtitle, trailing slot. Renders a link, button or plain item. */
export function Row({ title, sub, icon, iconBg, iconColor, end, chevron, href, onClick, className }: RowProps) {
  const tile = icon === undefined ? null : typeof icon === "string"
    ? <span className="ui-row-icon" style={{ background: iconBg, color: iconColor }}><Icon name={icon as IconName} size={18} /></span>
    : icon;
  const inner = (
    <>
      {tile}
      <span className="ui-row-main">
        <span className="ui-row-title">{title}</span>
        {sub && <span className="ui-row-sub">{sub}</span>}
      </span>
      <span className="ui-row-end">{end}{chevron && <Icon name="forward" size={16} />}</span>
    </>
  );
  const cls = cx("ui-row", !tile && "ui-row--noicon", className);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/** Segmented tabs (role=tablist). */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="ui-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span className="ui-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
