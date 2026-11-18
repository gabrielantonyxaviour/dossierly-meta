"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/client";
import { daysUntil, longDate } from "@/lib/client/format";
import type { SavedLetter } from "@/lib/client/store";
import type { CaseDeadline } from "@/lib/client/types";

/** The one deadline that matters: the nearest one still ahead. Red is reserved for this. */
export function DeadlineHero({ deadlines, letters }: { deadlines: CaseDeadline[]; letters: SavedLetter[] }) {
  const t = useT("home");
  const next = deadlines
    .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && daysUntil(x.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  if (!next) {
    return (
      <section className="deadline-hero is-clear" aria-labelledby="dl-h">
        <span className="tab-label" id="dl-h">{t("kind_deadline")}</span>
        <p className="dl-none">{t("noDeadline")}</p>
        <p className="small muted" style={{ margin: 0 }}>
          {t("noDeadlineBody")}
        </p>
      </section>
    );
  }
  const n = daysUntil(next.date);
  const letter = letters.find((l) => l.id === next.sourceEventId);
  return (
    <section className="deadline-hero" aria-labelledby="dl-h">
      <div className="row between">
        <span className="tab-label dl-label" id="dl-h">{t("deadlineMatters")}</span>
        <span className="dl-count mono">{n === 0 ? t("todayUnit") : n === 1 ? t("dayLeftOne") : t("daysLeftAria", { n })}</span>
      </div>
      <p className="dl-date mono">{longDate(next.date)}</p>
      <p className="dl-what">{next.what}</p>
      {letter && <p className="small muted" style={{ margin: 0 }}>{t("fromLetter", { date: longDate(letter.deliveryDate) })}</p>}
      <Link href="/app/letters" className="btn btn-small" style={{ marginTop: 12 }}>{t("seeCalc")}</Link>
    </section>
  );
}
