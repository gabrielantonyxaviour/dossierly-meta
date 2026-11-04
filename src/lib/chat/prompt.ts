import { caseContext } from "@/lib/case/context";
import type { CaseSnapshot } from "@/lib/case/types";
import type { ChatAttachment, ChatRequest } from "./schema";

export const PERSONA = [
  "You are Dossierly, a personal AI caseworker for a non-EU newcomer with a temporary residence permit in Poland.",
  "You explain, organise, translate and prepare.",
  "Rules:",
  "- Ground every claim in the CASE below, or name the official source (KPA articles, Ustawa o cudzoziemcach, the office's own pages).",
  "- Interpret-only: never give legal advice or predict decisions. For legal judgment, suggest a licensed adviser or the office.",
  "- Never claim to submit applications, log into MOS or inPOL, or contact offices for the user.",
  "- If the case lacks a fact, say so and say how to get it.",
  "- Answer plainly and briefly. Markdown is fine (bold, short lists).",
].join("\n");

export type CaseSource = { title: string; url: string; kind: "case" };

type Found = { title: string; detail: string };

function find(c: CaseSnapshot, a: ChatAttachment): Found | null {
  switch (a.kind) {
    case "deadline": {
      const d = c.deadlines.find((x) => x.id === a.id);
      return d ? { title: d.title, detail: `Deadline "${d.title}" due ${d.dueDate} [${d.status}]. Rule: ${d.computation.rule ?? "n/a"}. Steps: ${d.computation.steps.join(" > ") || "none"}` } : null;
    }
    case "document": {
      const d = c.documents.find((x) => x.id === a.id);
      const f = d ? Object.entries(d.extractedFields).map(([k, v]) => `${k}: ${v}`).join("; ") : "";
      return d ? { title: d.title, detail: `Document "${d.title}" (${d.kind}) ${d.status}${d.pages ? `, ${d.pages} pages` : ""}, source ${d.source}${f ? `. Fields: ${f}` : ""}` } : null;
    }
    case "event": {
      const e = c.events.find((x) => x.id === a.id);
      return e ? { title: e.summary.slice(0, 80), detail: `Event ${e.at} (${e.type}): ${e.summary}` } : null;
    }
    case "task": {
      const t = c.tasks.find((x) => x.id === a.id);
      return t ? { title: t.title, detail: `Task "${t.title}" [${t.status}], origin ${t.origin}${t.detail ? `. ${t.detail}` : ""}${t.dueDeadlineId ? ` For deadline #${t.dueDeadlineId}` : ""}` } : null;
    }
    case "appointment": {
      const p = c.appointments.find((x) => x.id === a.id);
      return p ? { title: p.title, detail: `Appointment "${p.title}" at ${p.at} at ${p.location.name}, ${p.location.address}. Purpose: ${p.purpose || "n/a"}` } : null;
    }
  }
}

/** Attached items that exist in the case, as prompt text and as sources to show the user. */
export function resolveAttachments(c: CaseSnapshot, attachments: ChatAttachment[] = []) {
  const found = attachments.flatMap((a) => {
    const f = find(c, a);
    return f ? [f] : [];
  });
  return {
    text: found.length ? `ATTACHED BY THE USER (they are asking about these):\n${found.map((f) => `- ${f.detail}`).join("\n")}` : "",
    sources: found.map((f): CaseSource => ({ title: f.title, url: "", kind: "case" })),
  };
}

export function buildSystemPrompt(c: CaseSnapshot, attachments: ChatAttachment[] = [], now = new Date()): { system: string; sources: CaseSource[] } {
  const att = resolveAttachments(c, attachments);
  const lang = c.profile.preferredLanguage;
  const parts = [PERSONA, `Reply in the user's preferred language (${lang}) unless they write in another.`, caseContext(c, now), att.text].filter(Boolean);
  return { system: parts.join("\n\n"), sources: att.sources };
}

export function buildMessages(system: string, req: ChatRequest) {
  return [{ role: "system" as const, content: system }, ...req.messages];
}
