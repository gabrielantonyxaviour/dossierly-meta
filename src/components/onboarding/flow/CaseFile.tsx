import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LanguageSchema } from "@/lib/schemas";
import { REASONS, STAGES, type Reason } from "./options";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import type { T } from "@/lib/i18n/translate";

const permitLabel = (t: T, p: Profile["permitType"], reason: Reason | null) => {
  const hint = REASONS.find((r) => r.id === reason)?.hint;
  return p === "temporary_residence_study" ? t("permitStudy") : p === "temporary_residence_work" ? t("permitWork")
    : p ? (hint ? t(hint) : t("permitOther")) : null;
};

/** The case taking shape as the person answers: amber marks what they told us, purple what came from official mail. */
export function CaseFile({ profile, reason, step, found }: { profile: Profile; reason: Reason | null; step: number; found: number }) {
  const t = useT("onboarding");
  const tag = LOCALE_TAGS[useLocale()];
  const lang = LanguageSchema.catch("en").parse(profile.preferredLanguage);
  const stageKey = STAGES.find((s) => s.id === profile.stage)?.title;
  const rows: [string, string | null][] = [
    [t("fileName"), profile.fullName],
    [t("fileLanguage"), profile.fullName ? new Intl.DisplayNames([tag, "en"], { type: "language" }).of(lang) ?? LANGUAGE_META[lang].label : null],
    [t("filePermit"), permitLabel(t, profile.permitType, reason)],
    [t("fileStage"), step > 3 && stageKey ? t(stageKey) : null],
    [t("city"), profile.city ? t("cityInPoland", { city: profile.city }) : null],
    [profile.permitType === "temporary_residence_work" ? t("fileEmployer") : t("fileUniversity"), profile.organisation],
    [t("fileArrived"), profile.arrivalDate ? new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${profile.arrivalDate}T00:00:00Z`)) : null],
  ];
  const filled = rows.filter(([, v]) => v);
  return (
    <aside className="ob-file" aria-label={t("fileAria")}>
      <div className="ob-file-head"><span>{t("fileTitle")}</span><span>{filled.length ? t("fileBuilding") : t("fileEmpty")}</span></div>
      <dl>
        {rows.map(([k, v]) => <div key={k} data-filled={!!v}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}
        <div data-filled={found > 0} data-source="official"><dt>{t("fileFromMail")}</dt><dd>{found ? (found === 1 ? t("fileConfirmedOne") : t("fileConfirmedMany", { n: found })) : step >= 5 ? t("fileReading") : "—"}</dd></div>
      </dl>
      <p className="ob-file-legend"><i data-source="user" />{t("legendUser")} <i data-source="official" />{t("legendOfficial")}</p>
    </aside>
  );
}
