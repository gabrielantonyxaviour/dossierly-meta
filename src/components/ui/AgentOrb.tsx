import { Icon, type IconName } from "../Icon";

/** The agent's signature gradient orb. `state`: idle breathes, live ripples (listening/speaking/thinking). */
export function AgentOrb({ size = 48, state = "idle", icon }: { size?: number; state?: "idle" | "live" | "still"; icon?: IconName }) {
  const cls = `ui-orb${state === "idle" ? " ui-orb--breathe" : state === "live" ? " ui-orb--live" : ""}`;
  return (
    <span className={cls} style={{ width: size, height: size }} aria-hidden="true">
      {icon && <Icon name={icon} size={Math.round(size * 0.42)} />}
    </span>
  );
}
