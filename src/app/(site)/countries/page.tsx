import type { Metadata } from "next";
import { CountryCards } from "@/components/site/Coverage";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("countriesMetaTitle") };
}

export default async function CountriesPage() {
  const t = await getT("site");
  return (
    <div className="wrap" style={{ paddingTop: 40 }}>
      <div className="section-head">
        <span className="kicker">{t("navCountries")}</span>
        <h1>{t("countriesTitle")}</h1>
        <p>{t("countriesLead")}</p>
      </div>
      <CountryCards />
    </div>
  );
}
