import type { MetadataRoute } from "next";

const SITE = "https://dossierly.cosmiclan.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api/", "/kit", "/onboarding", "/onboarding-preview"] }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
