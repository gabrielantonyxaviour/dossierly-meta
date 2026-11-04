"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nextStep, type NextStep } from "@/lib/case/next-step";
import type { CaseItemMap, CaseSnapshot, Collection, Profile } from "@/lib/case/types";

/* Client view of the server case (/api/case). One fetch shared by the whole shell; refreshes on focus and
   every 45 s so writes from other flows (letters, counter, calls) appear without a reload. */

type Status = "loading" | "ready" | "error";
type CaseData = {
  status: Status;
  error: string | null;
  snapshot: CaseSnapshot | null;
  next: NextStep | null;
  refresh: () => Promise<void>;
  patchItem: <K extends Collection>(kind: K, id: string, patch: Partial<CaseItemMap[K]>) => Promise<boolean>;
  patchProfile: (patch: Record<string, unknown>) => Promise<Profile | null>;
};

const Ctx = createContext<CaseData | null>(null);

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init, headers: init?.body ? { "content-type": "application/json" } : undefined });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) { window.location.href = `/signin?next=${encodeURIComponent(location.pathname)}`; throw new Error("Signed out"); }
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body as T;
}

export function CaseDataProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (inflight.current) return inflight.current;
    const p = json<CaseSnapshot>("/api/case")
      .then((s) => { setSnapshot(s); setStatus("ready"); setError(null); })
      .catch((e: Error) => { setError(navigator.onLine ? e.message : "You’re offline. Your case will refresh when you reconnect."); setStatus((old) => (old === "ready" ? "ready" : "error")); })
      .finally(() => { inflight.current = null; });
    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("dossierly:case-changed", onFocus);
    const t = setInterval(onFocus, 45_000);
    return () => { document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("online", onFocus); window.removeEventListener("dossierly:case-changed", onFocus); clearInterval(t); };
  }, [refresh]);

  const patchItem = useCallback<CaseData["patchItem"]>(async (kind, id, patch) => {
    let before: CaseSnapshot | null = null;
    setSnapshot((s) => { before = s; return s ? { ...s, [kind]: (s[kind] as { id: string }[]).map((it) => (it.id === id ? { ...it, ...patch } : it)) } : s; });
    try {
      await json(`/api/case/${kind}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      return true;
    } catch {
      if (before) setSnapshot(before);
      return false;
    }
  }, []);

  const patchProfile = useCallback<CaseData["patchProfile"]>(async (patch) => {
    try {
      const profile = await json<Profile>("/api/case/profile", { method: "PATCH", body: JSON.stringify(patch) });
      setSnapshot((s) => (s ? { ...s, profile } : s));
      return profile;
    } catch { return null; }
  }, []);

  const next = useMemo(() => (snapshot ? nextStep(snapshot) : null), [snapshot]);
  const value = useMemo(() => ({ status, error, snapshot, next, refresh, patchItem, patchProfile }), [status, error, snapshot, next, refresh, patchItem, patchProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCaseData(): CaseData {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCaseData must be used inside CaseDataProvider");
  return v;
}

/** Other flows call this after writing to the case so the shell refreshes immediately. */
export const announceCaseChange = () => window.dispatchEvent(new Event("dossierly:case-changed"));
