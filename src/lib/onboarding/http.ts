import { CaseClientError } from "../case/client";
import { ModelError } from "../model";
import { errorResponse, jsonError } from "../server/http";

/** `{ error, code? }` for case-store and model failures as well as ApiError/ZodError. Never leaks provider text. */
export function onboardingError(e: unknown): Response {
  if (e instanceof CaseClientError) return jsonError(e.status, e.message, e.code);
  if (e instanceof ModelError) {
    const status = e.code === "over_budget" || e.code === "rate_limited" ? 429 : e.code === "no_key" || e.code === "models_disabled" ? 503 : 502;
    const message = e.code === "over_budget" ? "Daily limit reached. Try again after 08:00 MYT."
      : e.code === "rate_limited" ? "The model is busy right now. Try again in a few seconds."
      : e.code === "no_key" || e.code === "models_disabled" ? "Reading is switched off on this server right now."
      : "The model could not read this right now. Try again.";
    return jsonError(status, message, e.code);
  }
  return errorResponse(e);
}
