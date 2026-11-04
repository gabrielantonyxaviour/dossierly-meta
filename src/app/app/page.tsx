import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CaseHome } from "@/components/app/home/CaseHome";
import { FLOW_HOME, previewFlow } from "@/lib/dev/preview";
import { getEnv } from "@/lib/server/env";

export default async function Page() {
  // voice/look previews: arriving from the landing page or sign-in goes straight to the flow under test.
  // Navigation inside the app (referer under /app) still opens Home.
  const flow = previewFlow(getEnv());
  if (flow === "voice" || flow === "look") {
    const ref = (await headers()).get("referer") ?? "";
    let fromApp = false;
    try { fromApp = new URL(ref).pathname.startsWith("/app"); } catch { /* no referer */ }
    if (!fromApp) redirect(FLOW_HOME[flow]);
  }
  return <CaseHome />;
}
