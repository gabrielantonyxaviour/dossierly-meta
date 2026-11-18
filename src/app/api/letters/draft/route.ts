import { z } from "zod";
import { withCase } from "@/lib/case/route";
import { CaseClientError } from "@/lib/case/client";
import { getEnv } from "@/lib/server/env";
import { writeDrafts } from "@/lib/watch/drafts";

export const dynamic = "force-dynamic";

const Body = z.object({ documentId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }).strict();

/**
 * Drafts for a letter already in the case (read with Look or from mail): a short Polish cover reply to the office
 * and, when an institution must issue something, a request to it. The person checks, edits and sends it themselves.
 */
export const POST = (req: Request) =>
  withCase(req, async (c, { userId, body }) => {
    const { documentId } = Body.parse(await body());
    const snap = await c.snapshot();
    const doc = snap.documents.find((d) => d.id === documentId && d.kind === "letter");
    if (!doc) throw new CaseClientError(404, "That letter is not in your case.", "letter_not_found");
    const fields = Object.entries(doc.extractedFields).map(([k, v]) => `${k}: ${v}`).join("\n");
    const office = snap.facts.office?.value ?? "Urząd wojewódzki";
    const asks = snap.tasks.filter((t) => t.status === "open").map((t) => t.title).slice(0, 8).join("; ");
    const out = await writeDrafts(getEnv(), userId, { id: doc.id, from: office, subject: doc.title, text: fields || doc.title, receivedAt: doc.createdAt, images: [], attachments: [] }, snap, asks);
    return { letterTitle: out.letterTitle, drafts: out.drafts };
  });
