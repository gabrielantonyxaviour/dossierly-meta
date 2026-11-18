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
import { getLocale } from "@/lib/i18n/server";
import { LOCALE_TAGS } from "@/lib/i18n/locales";

const text = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://dossierly.larinova.com"),
  title: { default: "Dossierly · your AI caseworker for life in Poland", template: "%s · Dossierly" },
  description:
    "A personal AI caseworker for newcomers with a temporary residence permit in Poland. It knows your case, explains official letters, counts deadlines the way Polish law does and helps you at the office counter.",
  openGraph: { type: "website", siteName: "Dossierly", locale: "en_GB", title: "Dossierly — your caseworker in Poland", description: "Letters explained, deadlines counted the way Polish law does, and help at the office counter. Your own private agent for your residence case.", url: "https://dossierly.larinova.com" },
  twitter: { card: "summary_large_image", title: "Dossierly — your caseworker in Poland", description: "Letters explained, deadlines counted the way Polish law does, and help at the office counter." },
  applicationName: "Dossierly",
  appleWebApp: { capable: true, title: "Dossierly", statusBarStyle: "black-translucent", startupImage: STARTUP },
  formatDetection: { telephone: false },
};

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
