import type { IconName } from "@/components/Icon";

export type NavItem = { href: string; label: string; icon: IconName; match?: string[] };

/** Bottom tab bar (phones). The agent sits in the centre as the orb. */
export const TABS_LEFT: NavItem[] = [
  { href: "/app", label: "Home", icon: "home" },
  { href: "/app/case", label: "Case", icon: "case" },
];
export const TABS_RIGHT: NavItem[] = [
  { href: "/app/look", label: "Look", icon: "scan", match: ["/app/look", "/app/letters", "/app/photo-check", "/app/mos-sheet", "/app/visit-plan"] },
  { href: "/app/counter", label: "Counter", icon: "counter", match: ["/app/counter", "/app/rehearse"] },
];
export const AGENT: NavItem = { href: "/app/chat", label: "Dossierly", icon: "sparkle", match: ["/app/chat"] };

/** Desktop sidebar. */
export const SIDE_MAIN: NavItem[] = [TABS_LEFT[0], TABS_LEFT[1], { ...AGENT, label: "Ask Dossierly", icon: "chat" }, TABS_RIGHT[0], TABS_RIGHT[1]];
export const SIDE_MORE: NavItem[] = [
  { href: "/app/notifications", label: "Notifications", icon: "bell" },
  { href: "/app/settings", label: "Settings", icon: "settings", match: ["/app/settings", "/app/connections", "/app/privacy"] },
];

/** Routes that take the whole screen on phones (no tab bar). */
export const IMMERSIVE = ["/app/chat", "/app/call", "/app/counter/live", "/app/rehearse/live"];

export function isActive(path: string, item: NavItem): boolean {
  if (item.href === "/app") return path === "/app";
  return (item.match ?? [item.href]).some((m) => path === m || path.startsWith(`${m}/`));
}
