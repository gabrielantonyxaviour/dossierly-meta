import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
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
const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dossierly.pages.dev"),
  title: { default: "Dossierly · your AI caseworker for life in Poland", template: "%s · Dossierly" },
  description:
    "A private AI caseworker that remembers your residence case: prepares you for the office, interprets live, reads official letters, links them to what was said and counts the deadline.",
  openGraph: { title: "Dossierly", description: "Your private AI caseworker for life abroad. Poland first.", url: "https://dossierly.pages.dev" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("dossierly:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${text.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies a saved light/dark choice before paint; "system" leaves the media query in charge. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
