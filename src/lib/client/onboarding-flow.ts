import type { Profile } from "@/lib/case/types";
import type { CalendarResult } from "@/lib/onboarding/commit";
import type { Finding, MailReading } from "@/lib/onboarding/findings";
import type { InboxMessage } from "@/lib/onboarding/inbox";
import type { OnboardingState } from "@/lib/server/onboarding";
import { call, friendlyError, type ApiResult } from "./api";

const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export type ConnectionRow = { provider: string; category: "mail" | "calendar"; label: string; status: "connected" | "reconnect" };
export type ConnectionStatus = { capabilities: { provider: string; category: string; available: boolean; reason?: string; notice?: string }[]; connections: { mail: ConnectionRow | null; calendar: ConnectionRow | null } };

export const flowApi = {
  state: () => call<{ onboarding: OnboardingState; profile: Profile; email: string | null }>("/api/onboarding"),
  step: (step: number) => call<{ onboarding: OnboardingState }>("/api/onboarding", json("POST", { action: "step", step })),
  phone: (number: string) => call<{ profile: Profile; callsAvailable: boolean }>("/api/onboarding", json("POST", { action: "phone", number })),
  skipPhone: () => call<{ profile: Profile; callsAvailable: boolean }>("/api/onboarding", json("POST", { action: "skip_phone" })),
  complete: () => call<{ onboarding: OnboardingState }>("/api/onboarding", json("POST", { action: "complete" })),
  profile: (patch: Partial<Profile>) => call<Profile>("/api/case/profile", json("PATCH", patch)),
  connections: () => call<ConnectionStatus>("/api/connections"),
  connect: (category: "mail" | "calendar", provider: string) => call<{ redirectUrl: string }>("/api/connections/connect", json("POST", { category, provider, returnPath: "/onboarding" })),
  inbox: () => call<{ messages: InboxMessage[]; account: string }>("/api/onboarding/inbox"),
  read: (messageId: string, fresh = false) => call<MailReading>("/api/onboarding/inbox/read", json("POST", { messageId, ...(fresh ? { fresh } : {}) })),
  commit: (body: { findings: Finding[]; summaries: { messageId: string; summary: string; receivedAt: string }[]; addToCalendar: boolean }) =>
    call<{ saved: number; calendar: CalendarResult[] }>("/api/onboarding/inbox/commit", json("POST", body)),
  welcome: (calendarAdded: boolean) => call<{ script: string; language: string }>("/api/onboarding/welcome", json("POST", { calendarAdded })),
};

export function failure<T>(r: ApiResult<T>): string | null {
  return r.ok ? null : friendlyError(r);
}
