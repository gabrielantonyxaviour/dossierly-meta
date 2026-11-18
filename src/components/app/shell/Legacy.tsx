"use client";
import Link from "next/link";
import { CaseProvider, useCase } from "@/lib/client/store";
import { EmptyState } from "@/components/ui";
import { Loading } from "../../States";
import { useT } from "@/lib/i18n/client";

/* Earlier on-device flows (letters, meet, prepare, privacy, connections) still read the encrypted local
   dossier. They keep working inside this boundary until their owning panes move them to the server case. */
export const LEGACY_ROUTES = ["/app/letters", "/app/meet", "/app/prepare", "/app/privacy"];
export const isLegacyRoute = (path: string) => LEGACY_ROUTES.some((r) => path === r || path.startsWith(`${r}/`));

function Gate({ children }: { children: React.ReactNode }) {
  const t = useT("shell");
  const { phase } = useCase();
  if (phase === "loading") return <div className="app-pad"><Loading label={t("opening")} /></div>;
  if (phase === "ready") return <>{children}</>;
  return (
    <EmptyState icon="lock" title={t("legacyTitle")} action={<Link href="/app" className="ui-btn ui-btn--sm">{t("backHome")}</Link>}>
      {t("legacyBody")}
    </EmptyState>
  );
}

export function LegacyBoundary({ children }: { children: React.ReactNode }) {
  return <CaseProvider><Gate>{children}</Gate></CaseProvider>;
}
