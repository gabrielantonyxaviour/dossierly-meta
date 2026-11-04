"use client";
import { useState } from "react";
import { Button, Card, Row, Section, useToast } from "@/components/ui";

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
  const [busy, setBusy] = useState<"fresh" | "sample" | null>(null);
  const run = async (reseed: boolean) => {
    setBusy(reseed ? "sample" : "fresh");
    if (!(await resetPreview(reseed))) { setBusy(null); toast("Reset failed. Try again.", { tone: "error" }); }
  };
  return (
    <Section title="Preview testing">
      <Card flush>
        <Row icon="refresh" title="Start onboarding fresh" sub="Clears this account’s case and setup on this preview, then opens onboarding."
          end={<Button size="sm" variant={flow === "onboarding" ? "primary" : "soft"} loading={busy === "fresh"} disabled={!!busy} onClick={() => void run(false)}>Start fresh</Button>} />
        {flow !== "onboarding" && (
          <Row icon="case" title="Reload the sample case" sub="Replaces this account’s case with Arjun’s fictional sample case."
            end={<Button size="sm" loading={busy === "sample"} disabled={!!busy} onClick={() => void run(true)}>Reload</Button>} />
        )}
        {flow !== "onboarding" && (
          <Row icon="mail" title="Add the evening letter scene" sub="Writes a labelled new letter, two drafts and a 09:00 reminder, then opens Ready for you. No call is placed."
            end={<Button size="sm" disabled={!!busy} onClick={() => window.location.assign("/api/dev/demo?scene=ready")}>Add</Button>} />
        )}
      </Card>
      <p className="ui-meta st-note">Only on preview deployments. Production never shows this.</p>
    </Section>
  );
}
