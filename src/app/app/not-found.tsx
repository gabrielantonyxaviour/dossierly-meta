import { ButtonLink, EmptyState } from "@/components/ui";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT("shell");
  return (
    <div className="sh-page">
      <div style={{ height: 56 }} />
      <EmptyState icon="info" title={t("notFoundTitle")} action={<ButtonLink href="/app" size="sm" icon="home">{t("backHome")}</ButtonLink>}>
        {t("notFoundBody")}
      </EmptyState>
    </div>
  );
}
