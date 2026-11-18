"use client";

import { useCallback } from "react";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { useLocale, useT } from "@/lib/i18n/client";
import { LANG_NAME, type CapturedItem, type TurnMetric } from "@/lib/voice/protocol";
import { Icon } from "../Icon";

const warsawToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());

/** A voice language code (hi, ta, pl…) named in the interface language. */
export function useLangName(): (code: string) => string {
  const t = useT("voice");
  return useCallback((code: string) => {
    const key = `lang_${code}`;
    const name = t(key);
    return name === key ? LANG_NAME[code] ?? code : name;
  }, [t]);
}

/** Tasks and deadlines the conversation just put in the case. */
export function Captured({ items }: { items: CapturedItem[] }) {
  const t = useT("voice");
  const tag = LOCALE_TAGS[useLocale()];
  if (!items.length) return null;
  const fmtDate = (d: string) => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const due = (d: string) => (d === warsawToday() ? t("today") : t("dueOn", { date: fmtDate(d) }));
  return (
    <ul className="vc-captured" aria-label={t("addedToCase")}>
      {items.map((c) => (
        <li key={c.id} className="vc-cap">
          <Icon name="check" size={16} />
          <span>
            <small>{c.kind === "deadline" ? t("deadlineAdded") : c.kind === "reminder" ? t("reminderSet") : t("taskAdded")}</small>
            <b>{c.title}</b>
            {c.detail && <i>{c.detail}</i>}
          </span>
          {c.dueDate && <em>{due(c.dueDate)}</em>}
        </li>
      ))}
    </ul>
  );
}

/** Honest latency: speech end → first translated/spoken audio, measured on the server, last turn and median. */
export function LatencyLine({ metrics }: { metrics: TurnMetric[] }) {
  const t = useT("voice");
  const done = metrics.filter((m) => typeof m.totalMs === "number");
  if (!done.length) return null;
  const last = done[done.length - 1];
  const sorted = done.map((m) => m.totalMs!).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const s = (ms?: number) => (typeof ms === "number" ? `${(ms / 1000).toFixed(1)} s` : "–");
  return (
    <p className="vc-latency" title={t("latencyTitle")}>
      <span>{t("lastReply", { s: s(last.totalMs) })}</span>
      <span>{t("latencyParts", { asr: s(last.asrMs), llm: s(last.llmMs), tts: s(last.ttsMs) })}</span>
      {done.length > 1 && <span>{t("median", { s: s(median), n: done.length })}</span>}
    </p>
  );
}
