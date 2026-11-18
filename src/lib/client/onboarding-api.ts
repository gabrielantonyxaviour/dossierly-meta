import { call, friendlyError } from "./api";
import { tNow } from "@/lib/i18n/current";
import type { OnboardingRequest, OnboardingState } from "@/lib/onboarding/schema";
export const onboardingApi = {
  get: () => call<OnboardingState>("/api/onboarding"),
  save: (body: OnboardingRequest) => call<OnboardingState>("/api/onboarding", { method: "POST", body: JSON.stringify(body) }),
};
export const operationError = (error: unknown): string => error instanceof Error ? error.message : tNow("onboarding")("requestUnfinished");
export function requireResult<T>(result: Awaited<ReturnType<typeof call<T>>>): T {
  if (!result.ok) throw new Error(result.code === "model_unavailable" ? tNow("onboarding")("readingUnavailable") : friendlyError(result));
  return result.data;
}
