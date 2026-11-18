"use client";

import { useState } from "react";
import { longDate, todayIso } from "@/lib/client/format";
import type { LetterRead } from "@/lib/client/types";
import { Attribution } from "../../Attribution";
import { DatePicker } from "../../ui/DatePicker";
import { useLocale, useT } from "@/lib/i18n/client";
import type { T } from "@/lib/i18n/translate";

const KINDS = ["wezwanie_braki_formalne", "decision", "card_collection", "fingerprint_appointment", "proceedings_extension", "other"];
const kindLabel = (t: T, k: string) => t(`kind_${KINDS.includes(k) ? k : "other"}`);

function confirmValue(t: T, read: LetterRead, key: string): { label: string; value: string } {
  const l = read.letter;
  if (key.startsWith("dateOnLetter")) return { label: t("dateOnLetter"), value: l.dateOnLetter ? longDate(l.dateOnLetter) : t("notFound") };
  if (key.startsWith("caseNumber")) return { label: t("caseNumber"), value: l.caseNumber ?? t("notFound") };
  if (key.startsWith("deadlineRule")) return { label: t("daysToReply"), value: l.deadlineRule.days !== null ? t("nDays", { n: l.deadlineRule.days }) : t("notStated") };
  return { label: key.replace(/[._]/g, " "), value: "" };
}

type Props = { read: LetterRead; delivery: string; onDelivery(v: string): void; onLink(): void; linking: boolean; linked: boolean };

export function LetterReading({ read, delivery, onDelivery, onLink, linking, linked }: Props) {
  const t = useT("letters");
  const locale = useLocale();
  const l = read.letter;
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const low = [...new Set(l.lowConfidence.map((k) => k.split(".")[0] === "deadlineRule" ? "deadlineRule" : k.split(".")[0]))];

  if (!l.readable) {
    return (
      <section className="card" role="alert">
        <h2 className="h-card">{t("unreadableTitle")}</h2>
        <p className="muted">{l.title || t("unclear")} {t("unreadableTip")}</p>
      </section>
    );
  }

  return (
    <section className="stack" aria-labelledby="letter-h" style={{ ["--gap" as string]: "14px" }}>
      <div className="card letter-head">
        <div className="row between">
          <span className="chip chip-official">{kindLabel(t, l.kind)}</span>
          <Attribution runs={read.runs} run={read.run} />
        </div>
        <h2 id="letter-h" style={{ margin: "10px 0 6px" }}>{l.title}</h2>
        <dl className="facts">
          {l.office && <div><dt>{t("from")}</dt><dd>{l.office}</dd></div>}
          {l.caseNumber && <div><dt>{t("caseNumber")}</dt><dd className="mono">{l.caseNumber}</dd></div>}
          {l.dateOnLetter && <div><dt>{t("dated")}</dt><dd className="mono">{longDate(l.dateOnLetter)}</dd></div>}
        </dl>
        {low.length > 0 && (
          <div className="confirm-row" aria-label={t("pleaseConfirm")}>
            <span className="small" style={{ fontWeight: 650 }}>{t("confirmPaper")}</span>
            {low.map((k) => {
              const v = confirmValue(t, read, k);
              const ok = confirmed.includes(k);
              return (
                <button key={k} type="button" className={`chip ${ok ? "chip-ok" : "chip-warn"}`} aria-pressed={ok} onClick={() => setConfirmed((c) => (ok ? c.filter((x) => x !== k) : [...c, k]))}>
                  {ok ? "✓ " : ""}{v.label}{v.value ? `: ${v.value}` : ""}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="two-up">
        <article className="card transcript" aria-label={t("transcriptAria")} lang="pl">
          <span className="tab-label" lang={locale}>{t("transcriptLabel")}</span>
          <p className="transcript-text">{l.transcript || "—"}</p>
        </article>
        <article className="card stack" aria-label={t("asksAria")} style={{ ["--gap" as string]: "12px" }}>
          <span className="tab-label">{t("asksLabel")}</span>
          <ol className="asks">
            {l.asks.map((a, i) => (
              <li key={i}>
                <span>{a}</span>
                {l.asksLocal[i] && <span className="asks-pl" lang="pl">„{l.asksLocal[i]}”</span>}
              </li>
            ))}
          </ol>
          {l.deadlineRule.quote && (
            <div className="rule-quote">
              <span className="tab-label">{t("ruleQuote")}</span>
              <p lang="pl" style={{ margin: "4px 0 0" }}>„{l.deadlineRule.quote}”</p>
            </div>
          )}
          {l.fields.length > 0 && (
            <details>
              <summary className="small" style={{ fontWeight: 650 }}>{t("fieldsExplained", { n: l.fields.length })}</summary>
              <ul className="small" style={{ marginTop: 8 }}>
                {l.fields.map((f) => <li key={f.label}><b lang="pl">{f.label}</b>: {f.meaning}{f.howToFill && ` ${f.howToFill}`}</li>)}
              </ul>
            </details>
          )}
        </article>
      </div>

      {!linked && (
        <div className="card stack delivery" style={{ ["--gap" as string]: "12px" }}>
          <h2 className="h-card">{t("whenReceived")}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {t("deliveryHelp")}
          </p>
          <div className="row">
            <DatePicker id="delivery-date" ariaLabel={t("deliveryDate")} value={delivery} max={todayIso()} onChange={onDelivery} placeholder={t("deliveryPlaceholder")} />
            <button className="btn btn-primary" onClick={onLink} disabled={linking || !delivery}>{linking ? t("linking") : t("linkButton")}</button>
          </div>
        </div>
      )}
    </section>
  );
}
