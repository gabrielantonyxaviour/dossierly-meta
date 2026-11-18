import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { LanguagePicker } from "./LanguagePicker";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const t = await getT("site");
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="stack" style={{ ["--gap" as string]: "10px" }}>
          <Logo size={24} />
          <p className="small muted" style={{ maxWidth: 380 }}>{t("footerAi")}</p>
          <p className="tiny muted">{t("footerOperator")} · <a href="mailto:gabriel@larinova.com">gabriel@larinova.com</a></p>
          <LanguagePicker compact className="footer-lang" />
        </div>
        <nav aria-label={t("navFooter")} className="footer-links">
          <Link href="/pricing">{t("navPricing")}</Link>
          <Link href="/legal/terms">{t("navTerms")}</Link>
          <Link href="/legal/privacy">{t("navPrivacy")}</Link>
          <Link href="/limits">{t("navLimits")}</Link>
          <Link href="/countries">{t("navCountries")}</Link>
        </nav>
      </div>
    </footer>
  );
}
