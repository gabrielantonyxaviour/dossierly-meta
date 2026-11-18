import { currentTag, tNow } from "@/lib/i18n/current";
import type { Run } from "./types";

const MODEL_NAMES: Record<string, string> = {
  "muse-spark-1.3": "Muse Spark 1.3",
  "muse-spark-1.2": "Muse Spark 1.2",
  "muse-voice-transcribe-1.0": "Muse Voice Transcribe",
  "sam-3.1": "SAM 3.1",
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "claude-haiku-5-5": "Claude Haiku 5.5",
  "claude-opus-5-5": "Claude Opus 5.5",
  "scribe_v3_live": "ElevenLabs Scribe",
  "scribe_v3": "ElevenLabs Scribe",
};

export function modelName(id: string): string {
  if (MODEL_NAMES[id]) return MODEL_NAMES[id];
  const tail = id.split("/").pop() ?? id;
  return tail.replace(/[-_]/g, " ");
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

/** "Claude Sonnet 5.5 · 0.9 s" */
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

/** "Tue 10 Nov 2026" in English (UTC so the date never shifts with the device time zone). */
export function longDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat(currentTag(), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parseIso(iso));
}
export function shortDate(iso: string): string {
  if (!isIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat(currentTag(), { day: "numeric", month: "short", timeZone: "UTC" }).format(parseIso(iso));
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
  const t = tNow("time");
  if (n === 0) return t("today");
  if (n === 1) return t("tomorrow");
  if (n === -1) return t("yesterday");
  return n > 0 ? t("inDays", { n }) : t("daysAgo", { n: -n });
}

export const clock = (ts: number) =>
  new Intl.DateTimeFormat(currentTag(), { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(ts));

export const shortHash = (h: string) => (h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-6)}` : h);
