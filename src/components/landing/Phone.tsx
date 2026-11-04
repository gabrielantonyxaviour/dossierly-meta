import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { AgentOrb } from "@/components/ui";

type Tab = "home" | "case" | "look" | "counter" | null;

const TABS: { id: Exclude<Tab, null>; label: string; icon: IconName }[] = [
  { id: "home", label: "Home", icon: "home" },
  { id: "case", label: "Case", icon: "case" },
  { id: "look", label: "Look", icon: "scan" },
  { id: "counter", label: "Counter", icon: "counter" },
];

/** The app's bottom tab bar, drawn small: Home, Case, the agent orb, Look, Counter. */
function TabBar({ active }: { active: Tab }) {
  const cell = (t: (typeof TABS)[number]) => (
    <span key={t.id} className={t.id === active ? "is-on" : undefined}>
      <Icon name={t.icon} size={17} />
      {t.label}
    </span>
  );
  return (
    <div className="dl-tabbar">
      {TABS.slice(0, 2).map(cell)}
      <span className="dl-tabbar-orb"><AgentOrb size={38} state="still" icon="sparkle" /></span>
      {TABS.slice(2).map(cell)}
    </div>
  );
}

/**
 * A phone drawn in HTML/CSS around a product screen. It is one image to assistive tech: `label`
 * describes what the screen shows and the inner mock is hidden from the accessibility tree.
 */
export function Phone({ label, children, tab = null, tone = "app", className }: {
  label: string;
  children: ReactNode;
  tab?: Tab | "none";
  tone?: "app" | "dark";
  className?: string;
}) {
  return (
    <div className={`dl-phone${className ? ` ${className}` : ""}`} role="img" aria-label={label}>
      <div className={`dl-screen${tone === "dark" ? " dl-screen--dark" : ""}`} aria-hidden="true">
        <span className="dl-island" />
        <div className="dl-status">
          <span>9:41</span>
          <span className="dl-status-r"><i /><i /><i /><b /></span>
        </div>
        {children}
        {tab !== "none" && <TabBar active={tab} />}
      </div>
    </div>
  );
}
