import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("site");
  return { title: t("limitsMetaTitle"), description: t("limitsMetaDesc") };
}

/* Limit n reads limit{n} (title) and limit{n}d (detail) from the site messages. */
const KNOWN = [1, 2, 3, 4, 5, 6, 7];

export default async function LimitsPage() {
  const t = await getT("site");
  return (
    <div className="doc-page">
      <span className="kicker">{t("limitsKicker")}</span>
      <h1>{t("limitsTitle")}</h1>
      <p className="lead muted">{t("limitsLead")}</p>
      <div className="stack" style={{ marginTop: 24 }}>
        <ul className="cov-list">
          {KNOWN.map((n) => (
            <li key={n} className="cov-item">
              <b>{t(`limit${n}`)}</b>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{t(`limit${n}d`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
