"use client";

import { useEffect, useState } from "react";
import { getMe } from "./api";

export type AccountState = "loading" | "signed-in" | "signed-out";

let shared: Promise<AccountState> | null = null;

/** One /api/me call per page load, shared by every link and guard that needs to know the session. */
export function accountState(): Promise<AccountState> {
  if (!shared) shared = getMe().then((r) => (r.ok ? "signed-in" : "signed-out"), () => "signed-out");
  return shared;
}

export function useAccountState(): AccountState {
  const [s, setS] = useState<AccountState>("loading");
  useEffect(() => { void accountState().then(setS); }, []);
  return s;
}

/** Only same-site paths under /app are allowed as a post-sign-in destination. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !(raw.startsWith("/app") || raw === "/plan" || raw.startsWith("/plan?")) || raw.startsWith("//")) return "/app";
  return raw;
}

export function signInUrl(): string {
  const here = typeof window === "undefined" ? "/app" : window.location.pathname + window.location.search;
  return `/signin?next=${encodeURIComponent(safeNext(here))}`;
}
