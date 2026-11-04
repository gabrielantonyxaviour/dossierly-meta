import type { MetadataRoute } from "next";

const SITE = "https://dossierly.cosmiclan.com";

/** Public pages only; the app, API and preview tools are not indexed (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["", 1, "weekly"],
    ["/pricing", 0.8, "monthly"],
    ["/countries", 0.6, "monthly"],
    ["/countries/poland", 0.7, "monthly"],
    ["/limits", 0.5, "monthly"],
    ["/legal/privacy", 0.3, "yearly"],
    ["/legal/terms", 0.3, "yearly"],
  ];
  const lastModified = new Date("2026-11-04T00:00:00Z");
  return pages.map(([path, priority, changeFrequency]) => ({ url: `${SITE}${path}`, lastModified, changeFrequency, priority }));
}
