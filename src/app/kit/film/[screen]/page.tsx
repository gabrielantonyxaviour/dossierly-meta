import { notFound } from "next/navigation";
import { getEnv } from "@/lib/server/env";
import { filmSnapshot } from "../fixture";
import { FilmScreen } from "./FilmScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Layout check", robots: { index: false } };

const SCREENS = ["home", "case", "ready", "notifications", "settings"] as const;

/** Preview/local only: the real App UX screens over the film's fixture case, for headless phone checks. */
export default async function Page({ params, searchParams }: { params: Promise<{ screen: string }>; searchParams: Promise<{ t?: string }> }) {
  if (getEnv().APP_ENV === "production") notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const { t } = await searchParams;
  return <FilmScreen screen={screen as (typeof SCREENS)[number]} snapshot={filmSnapshot(t === "evening" || screen === "ready")} />;
}
