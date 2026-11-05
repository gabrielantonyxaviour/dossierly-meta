import { caseClient } from "@/lib/case/client";
import { writeReadyScene } from "@/lib/dev/ready-scene";
import { getEnv } from "@/lib/server/env";
import { ApiError, errorResponse } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { signTicket } from "@/lib/voice/token";
import { sessionId, voiceLang } from "@/lib/voice/server/issue";
import { letterReason, type NewLetter } from "@/lib/voice/server/twilio";

export const dynamic = "force-dynamic";

/**
 * PREVIEW-ONLY test rig for the letter call (film A7): issues the same phone-mode ticket placeCall() gives Twilio, with
 * the same letterReason() for the enrolment-request letter, but for the signed-in account's browser WebSocket.
 * The conversation runs through VoiceDO's phone path unchanged; only the transport differs. Never places a call.
 */
export async function POST(req: Request) {
  try {
    const env = getEnv();
    if (env.APP_ENV !== "preview") throw new ApiError(404, "Not found", "not_found");
    if (!env.SESSION_SECRET) throw new ApiError(503, "Voice sessions are not configured", "voice_unconfigured");
    const { userId } = await requireUser(req);
    const cc = caseClient(userId);
    let snap = await cc.snapshot();
    if (!snap.documents.some((d) => d.id === "doc-enrol-letter")) {
      await writeReadyScene(userId);
      snap = await cc.snapshot();
    }
    const letter: NewLetter = {
      title: "Letter from the office: certificate of enrolment", sender: "Mazowiecki Urząd Wojewódzki", letterDocId: "doc-enrol-letter",
      asks: "a certificate that you are enrolled and continuing your studies", dueDate: "2026-11-25", deadlineId: "dl-enrolment",
      prepared: ["a reply to the office (draft)", "a request to your dean's office for the certificate of enrolment (draft)"], draftIds: ["doc-draft-office", "doc-draft-dean"],
    };
    const s = sessionId();
    const ticket = await signTicket(env.SESSION_SECRET, { u: userId, s, m: "phone", l: voiceLang(snap.profile.preferredLanguage), e: Date.now() + 10 * 60_000, r: letterReason(letter).slice(0, 1500) });
    return Response.json({ path: `/api/voice/ws/${s}?t=${encodeURIComponent(ticket)}`, reason: letterReason(letter) }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

export { PUT, PATCH, DELETE } from "@/lib/server/get-only";
