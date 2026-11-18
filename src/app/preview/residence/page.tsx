import type { Metadata } from "next";
import { ResidencePreview } from "@/components/residence/Preview";

export const metadata: Metadata = {
  title: "Residence case preview",
  description: "Tap-through preview of Dossierly's residence permit case path.",
  robots: { index: false, follow: false },
};

export default function ResidencePreviewPage() {
  return <ResidencePreview />;
}
