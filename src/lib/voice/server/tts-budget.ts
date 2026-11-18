/*
 * Hard daily ceiling on ElevenLabs text-to-speech characters. The plan has no headroom and may not be upgraded, so
 * every synthesis reserves its characters here BEFORE the request and is refused with code `tts_cap` once today's
 * total would pass ELEVENLABS_DAILY_CHAR_CAP (default 4000). The count lives in D1 (budgets row kind `tts_chars`,
 * scope `global`, spent_micro holds characters); an isolate-local counter backs it when no database is bound.
 */
import { ELEVENLABS_DAILY_CHAR_CAP } from "../../config";
import type { Env } from "../../server/env";
import { dayKey } from "../../server/util";

export const TTS_CAP_MESSAGE = "Spoken replies are paused for today. You can keep reading the text.";
const KIND = "tts_chars";

type AnyEnv = object | undefined;

export class TtsCapError extends Error {
  readonly code = "tts_cap";
  readonly status = 429;
  constructor() {
    super(TTS_CAP_MESSAGE);
  }
}

export function ttsDailyCap(env: AnyEnv): number {
  const raw = (env as Record<string, unknown> | undefined)?.ELEVENLABS_DAILY_CHAR_CAP;
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : ELEVENLABS_DAILY_CHAR_CAP;
}

const db = (env: AnyEnv): Env["DB"] | null => {
  const d = (env as { DB?: Env["DB"] } | undefined)?.DB;
  return typeof d === "object" && d !== null ? d : null;
};

let local = { day: "", used: 0 };
const localUsed = () => (local.day === dayKey() ? local.used : 0);

/** Reserves `chars` for today or throws TtsCapError. Never lets the day's total pass the cap. */
export async function reserveTtsChars(env: AnyEnv, chars: number): Promise<void> {
  const cap = ttsDailyCap(env);
  const n = Math.max(0, Math.ceil(chars));
  const d = db(env);
  if (!d) {
    if (localUsed() + n > cap) throw new TtsCapError();
    local = { day: dayKey(), used: localUsed() + n };
    return;
  }
  const day = dayKey();
  const upd = await d.prepare("UPDATE budgets SET spent_micro = spent_micro + ? WHERE day = ? AND scope = 'global' AND kind = ? AND spent_micro + ? <= ?").bind(n, day, KIND, n, cap).run();
  if ((upd.meta?.changes ?? 0) > 0) return;
  const ins = await d.prepare("INSERT OR IGNORE INTO budgets (day, scope, kind, spent_micro) SELECT ?, 'global', ?, ? WHERE ? <= ?").bind(day, KIND, n, n, cap).run();
  if ((ins.meta?.changes ?? 0) > 0) return;
  // Lost a race between the UPDATE and the INSERT: one more try, then refuse.
  const again = await d.prepare("UPDATE budgets SET spent_micro = spent_micro + ? WHERE day = ? AND scope = 'global' AND kind = ? AND spent_micro + ? <= ?").bind(n, day, KIND, n, cap).run();
  if ((again.meta?.changes ?? 0) === 0) throw new TtsCapError();
}

/** Gives characters back when the request failed before ElevenLabs billed them. Never throws. */
export async function releaseTtsChars(env: AnyEnv, chars: number): Promise<void> {
  const n = Math.max(0, Math.ceil(chars));
  const d = db(env);
  try {
    if (!d) local = { day: dayKey(), used: Math.max(0, localUsed() - n) };
    else await d.prepare("UPDATE budgets SET spent_micro = MAX(0, spent_micro - ?) WHERE day = ? AND scope = 'global' AND kind = ?").bind(n, dayKey(), KIND).run();
  } catch {
    /* an under-refund only makes the cap stricter */
  }
}

/** Characters used today (status page). */
export async function ttsCharsToday(env: AnyEnv): Promise<{ used: number; cap: number }> {
  const d = db(env);
  const cap = ttsDailyCap(env);
  if (!d) return { used: localUsed(), cap };
  const row = await d.prepare("SELECT spent_micro FROM budgets WHERE day = ? AND scope = 'global' AND kind = ?").bind(dayKey(), KIND).first<{ spent_micro: number }>();
  return { used: row?.spent_micro ?? 0, cap };
}

/** Tests only. */
export function resetTtsBudget(): void {
  local = { day: "", used: 0 };
}
