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

const text = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dossierly.cosmiclan.com"),
  title: { default: "Dossierly · your AI caseworker for life in Poland", template: "%s · Dossierly" },
  description:
    "A personal AI caseworker for newcomers with a temporary residence permit in Poland. It knows your case, explains official letters, counts deadlines the way Polish law does and helps you at the office counter. Built on Meta Muse.",
  openGraph: { type: "website", siteName: "Dossierly", locale: "en_GB", title: "Dossierly — your caseworker in Poland, built on Meta Muse", description: "Letters explained, deadlines counted the way Polish law does, and help at the office counter. Your own private agent for your residence case.", url: "https://dossierly.cosmiclan.com" },
  twitter: { card: "summary_large_image", title: "Dossierly — your caseworker in Poland, built on Meta Muse", description: "Letters explained, deadlines counted the way Polish law does, and help at the office counter." },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${text.variable} ${mono.variable}`} data-theme="dark" style={{ colorScheme: "dark" }}>
      <body>{children}</body>
    </html>
  );
}
