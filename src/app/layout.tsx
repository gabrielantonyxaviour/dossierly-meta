import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/components/ui/tokens.css";
import "@/components/ui/ui.css";
import "@/components/ui/overlay.css";
import "@/components/ui/mobile.css";
import "./site.css";
import "./landing.css";
import "./app.css";
import "./features.css";
import "./meet.css";
import "./controls.css";

import { STARTUP } from "./startup-images";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

const text = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

const OG_LOCALE: Record<string, string> = { en: "en_GB", hi: "hi_IN", uk: "uk_UA", ta: "ta_IN" };

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getT("site"), getLocale()]);
  return {
    metadataBase: new URL(process.env.APP_URL || "https://dossierly.larinova.com"),
    title: { default: t("metaTitle"), template: "%s · Dossierly" },
    description: t("metaDescription"),
    openGraph: { type: "website", siteName: "Dossierly", locale: OG_LOCALE[locale], title: t("ogTitle"), description: t("ogDescription"), url: "https://dossierly.larinova.com" },
    twitter: { card: "summary_large_image", title: t("ogTitle"), description: t("twitterDescription") },
    applicationName: "Dossierly",
    appleWebApp: { capable: true, title: "Dossierly", statusBarStyle: "black-translucent", startupImage: STARTUP },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#121110",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={LOCALE_TAGS[locale]} className={`${text.variable} ${mono.variable}`} data-theme="dark" style={{ colorScheme: "dark" }}>
      <body><I18nProvider locale={locale}>{children}</I18nProvider></body>
    </html>
  );
}
