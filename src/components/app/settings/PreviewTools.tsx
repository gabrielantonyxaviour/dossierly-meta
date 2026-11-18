"use client";
import { useState } from "react";
import { Button, Card, Row, Section, useToast } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

export type PreviewFlow = "onboarding" | "app" | "voice" | "look";

/** POST /api/dev/reset, clear this device's cached Dossierly state, then go where the server says. */
export async function resetPreview(reseed: boolean): Promise<boolean> {
  const res = await fetch("/api/dev/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reseed }) }).catch(() => null);
  if (!res?.ok) return false;
  const { next } = (await res.json()) as { next: string };
  try { Object.keys(localStorage).filter((k) => k.startsWith("dossierly:")).forEach((k) => localStorage.removeItem(k)); } catch { /* storage blocked */ }
  window.location.assign(next);
  return true;
}

/** Preview deployments only: restart onboarding, or reload the labelled sample case. */
export function PreviewTools({ flow }: { flow: PreviewFlow }) {
  const { toast } = useToast();
  const t = useT("settings");
  const [busy, setBusy] = useState<"fresh" | "sample" | null>(null);
  const run = async (reseed: boolean) => {
    setBusy(reseed ? "sample" : "fresh");
    if (!(await resetPreview(reseed))) { setBusy(null); toast(t("resetFailed"), { tone: "error" }); }
  };
  return (
    <Section title={t("previewTitle")}>
      <Card flush>
        <Row icon="refresh" title={t("freshTitle")} sub={t("freshSub")}
          end={<Button size="sm" variant={flow === "onboarding" ? "primary" : "soft"} loading={busy === "fresh"} disabled={!!busy} onClick={() => void run(false)}>{t("freshButton")}</Button>} />
        {flow !== "onboarding" && (
          <Row icon="case" title={t("sampleTitle")} sub={t("sampleSub")}
            end={<Button size="sm" loading={busy === "sample"} disabled={!!busy} onClick={() => void run(true)}>{t("sampleButton")}</Button>} />
        )}
        {flow !== "onboarding" && (
          <Row icon="mail" title={t("sceneTitle")} sub={t("sceneSub")}
            end={<Button size="sm" disabled={!!busy} onClick={() => window.location.assign("/api/dev/demo?scene=ready")}>{t("sceneButton")}</Button>} />
        )}
      </Card>
      <p className="ui-meta st-note">{t("previewNote")}</p>
    </Section>
  );
}
