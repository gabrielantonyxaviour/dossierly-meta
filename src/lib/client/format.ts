import type { Run } from "./types";

const MODEL_NAMES: Record<string, string> = {
  "muse-spark-1.3": "Muse Spark 1.3",
  "muse-spark-1.2": "Muse Spark 1.2",
  "muse-voice-transcribe-1.0": "Muse Voice Transcribe",
  "sam-3.1": "SAM 3.1",
};

export function modelName(id: string): string {
  if (MODEL_NAMES[id]) return MODEL_NAMES[id];
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/[-_]/g, " ");
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** "Muse Spark 1.3 · 0.9 s" */
export const runLabel = (r: Run) => `${modelName(r.model)} · ${seconds(r.ms)}`;

export function usd(n: number): string {
  if (n === 0) return "$0";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
};
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** "Tue 10 Nov 2026" (UTC so the date never shifts with the device time zone). */
export function longDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parseIso(iso));
}
export function shortDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(parseIso(iso));
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole days from today (local) to the ISO date; negative when past. */
export function daysUntil(iso: string): number {
  return Math.round((parseIso(iso).getTime() - parseIso(todayIso()).getTime()) / 86_400_000);
}

export function relDays(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export const clock = (ts: number) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(ts));

export const shortHash = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
