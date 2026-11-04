import { CaseClientError, type CaseClient } from "@/lib/case/client";
import type { PlanItem } from "./types";

/** Short deterministic id: the same appointment and item always map to the same task. */
export function taskIdFor(appointmentId: string, itemId: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${appointmentId}|${itemId}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `vp_${h.toString(36)}_${itemId.replace(/[^a-z0-9]/g, "").slice(0, 20)}`;
}

/** Creates one task per missing item (409 = already created) and links them to the appointment. Returns all task ids. */
export async function saveMissingAsTasks(
  client: CaseClient,
  appointment: { id: string; prepTaskIds: string[] },
  items: PlanItem[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const it of items.filter((i) => i.status === "missing")) {
    const id = taskIdFor(appointment.id, it.id);
    try {
      await client.create("tasks", { id, title: `Bring: ${it.title.replace(/^bring\s+/i, "")}`.slice(0, 200), detail: it.detail.slice(0, 2000), origin: "agent" });
    } catch (e) {
      if (!(e instanceof CaseClientError && e.status === 409)) throw e;
    }
    ids.push(id);
  }
  const merged = [...new Set([...appointment.prepTaskIds, ...ids])].slice(0, 20);
  if (ids.length && merged.length !== appointment.prepTaskIds.length) await client.patch("appointments", appointment.id, { prepTaskIds: merged });
  return ids;
}
