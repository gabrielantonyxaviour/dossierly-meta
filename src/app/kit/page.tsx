import { notFound } from "next/navigation";
import { getEnv } from "@/lib/server/env";
import { MobileKitDemo } from "./MobileKitDemo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mobile kit", robots: { index: false } };

/** Live reference for the mobile-first primitives (previews and local only). */
export default function KitPage() {
  if (getEnv().APP_ENV === "production") notFound();
  return <MobileKitDemo />;
}
