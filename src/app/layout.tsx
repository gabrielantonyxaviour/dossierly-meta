import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "@/components/ui/tokens.css";
import "@/components/ui/ui.css";
import "@/components/ui/overlay.css";
import "./site.css";
import "./landing.css";
import "./app.css";
import "./features.css";
import "./meet.css";
import "./controls.css";

const text = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dossierly.cosmiclan.com"),
  title: { default: "Dossierly · your AI caseworker for life in Poland", template: "%s · Dossierly" },
  description:
    "A personal AI caseworker for newcomers with a temporary residence permit in Poland. It knows your case, explains official letters, counts deadlines the way Polish law does and helps you at the office counter. Built on Meta Muse.",
  openGraph: { title: "Dossierly", description: "Your own caseworker for life in Poland. Built on Meta Muse.", url: "https://dossierly.cosmiclan.com" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121110",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${text.variable} ${mono.variable}`} data-theme="dark" style={{ colorScheme: "dark" }}>
      <body>{children}</body>
    </html>
  );
}
