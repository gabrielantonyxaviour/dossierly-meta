import type { Metadata } from "next";
import { OnboardingPreview } from "@/components/onboarding-preview/OnboardingPreview";
import { getT } from "@/lib/i18n/server";
import "./preview.css";
import "./workbench.css";
import "./chat.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("tour");
  return { title: t("metaTitle"), description: t("metaDescription"), robots: { index: false, follow: false } };
}

export default function Page() {
  return <OnboardingPreview />;
}
