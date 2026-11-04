import { notFound } from "next/navigation";
import { getEnv } from "@/lib/server/env";
import { filmSnapshot } from "../fixture";
import { withReview } from "../review-fixture";
import { FilmScreen } from "./FilmScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Layout check", robots: { index: false } };

const SCREENS = ["home", "case", "ready", "notifications", "settings", "review"] as const;

/** Preview/local only: the real App UX screens over the film's fixture case, for headless phone checks. */
export default async function Page({ params, searchParams }: { params: Promise<{ screen: string }>; searchParams: Promise<{ t?: string }> }) {
  if (getEnv().APP_ENV === "production") notFound();
  const { screen } = await params;
  if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const { t } = await searchParams;
  const base = filmSnapshot(t === "evening" || screen === "ready");
  const { snap, review } = t === "review" || screen === "review" ? withReview(base, new Date().toISOString()) : { snap: base, review: null };
  return (
    <>
      {/* The browser check stubs GET /api/case/review with this fixture (the kit page has no session). */}
      {review && <script type="application/json" id="kit-review" dangerouslySetInnerHTML={{ __html: JSON.stringify({ review }).replace(/</g, "\\u003c") }} />}
      <FilmScreen screen={screen as (typeof SCREENS)[number]} snapshot={snap} />
    </>
  );
}
