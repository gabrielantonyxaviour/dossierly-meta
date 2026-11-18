import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { HeaderActions } from "./HeaderActions";
import { Logo } from "./Logo";

export async function SiteHeader() {
  const t = await getT("site");
  return (
    <header className="site-header">
      <div className="wrap site-bar">
        <Link href="/" aria-label={t("homeAria")} className="logo-link"><Logo /></Link>
        <nav aria-label={t("navMain")} className="site-nav">
          <Link href="/#how">{t("navHow")}</Link>
          <Link href="/#privacy">{t("navPrivacy")}</Link>
          <Link href="/countries">{t("navCountries")}</Link>
          <Link href="/pricing">{t("navPricing")}</Link>
        </nav>
        <HeaderActions />
      </div>
    </header>
  );
}
