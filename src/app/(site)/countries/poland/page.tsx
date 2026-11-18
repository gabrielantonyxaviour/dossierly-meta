import type { Metadata } from "next";
import Link from "next/link";
import { PL_STATS, StatRow } from "@/components/site/Coverage";
import { PolandCoverage } from "@/components/site/PolandCoverage";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("polandMetaTitle"), description: t("polandMetaDesc") };
}

export default async function PolandPage() {
  const t = await getT("site");
  return (
    <div className="doc-page" style={{ maxWidth: 960 }}>
      <Link href="/countries" className="small">← {t("allCountries")}</Link>
      <span className="kicker" style={{ marginTop: 20 }}>{t("polandKicker")}</span>
      <h1>{t("poland")}</h1>
      <p className="lead muted">{t("polandLead")}</p>
      <StatRow t={t} stats={PL_STATS} style={{ margin: "20px 0 36px", maxWidth: 560 }} />
      <PolandCoverage />
    </div>
  );
}
