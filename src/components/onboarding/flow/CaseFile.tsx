import type { Profile } from "@/lib/case/types";
import { LANGUAGE_META } from "@/lib/config";
import { LanguageSchema } from "@/lib/schemas";
import { fileByDate } from "@/lib/residence/dates";
import { VOIVODESHIP_INFO } from "@/lib/residence/model";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_TAGS } from "@/lib/i18n/locales";
import { permitShort } from "@/components/app/residence/start/FamilyPlan";

/** The case taking shape as the person answers: amber marks what they told us, purple what came from official mail. */
export function CaseFile({ profile, step }: { profile: Profile; step: number }) {
  const t = useT("onboarding");
  const tr = useT("residence");
  const tag = LOCALE_TAGS[useLocale()];
  const lang = LanguageSchema.catch("en").parse(profile.preferredLanguage);
  const day = (ymd: string) => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));
  const household = profile.household ?? [];
  const rows: [string, string | null][] = [
    [tr("fileSituation"), profile.situation ? tr(`sit${profile.situation[0]!.toUpperCase()}${profile.situation.slice(1)}Short`) : null],
    [t("filePermit"), profile.permitType && profile.permitType !== "other" ? permitShort(tr, profile.permitType) : null],
    [tr("fileRegion"), profile.voivodeship ? [profile.city, VOIVODESHIP_INFO[profile.voivodeship].name].filter(Boolean).join(", ") : null],
    [tr("fileFileBy"), profile.legalStayUntil ? day(fileByDate(profile.legalStayUntil)) : null],
    [tr("fileEmployer"), profile.employerPays ? tr(`pays_${profile.employerPays}`) : null],
    [tr("fileHousehold"), step > 6 || household.length ? (household.length ? household.map((m) => m.name.split(/\s+/)[0]).join(", ") : tr("justYou")) : null],
    [t("fileName"), profile.fullName],
    [t("fileLanguage"), profile.fullName && step > 7 ? new Intl.DisplayNames([tag, "en"], { type: "language" }).of(lang) ?? LANGUAGE_META[lang].label : null],
  ];
  const filled = rows.filter(([, v]) => v);
  return (
    <aside className="ob-file" aria-label={t("fileAria")}>
      <div className="ob-file-head"><span>{t("fileTitle")}</span><span>{filled.length ? t("fileBuilding") : t("fileEmpty")}</span></div>
      <dl>
        {rows.map(([k, v]) => <div key={k} data-filled={!!v}><dt>{k}</dt><dd>{v ?? "—"}</dd></div>)}
      </dl>
      <p className="ob-file-legend"><i data-source="user" />{t("legendUser")} <i data-source="official" />{t("legendOfficial")}</p>
    </aside>
  );
}
