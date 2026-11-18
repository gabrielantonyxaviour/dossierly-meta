"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { signInUrl } from "./account";
import { api, ensureSession, startSession, type AccountMe } from "./api";
import { emptyCase, sampleCase } from "./sample";
import type { Case, Language, Letter, Run, Status } from "./types";
import type { Answers } from "@/components/onboarding-preview/content";
import type { Need } from "@/lib/onboarding/schema";
import type { OnboardingDraft, Review } from "./onboarding-state";
import { CaseSchema } from "@/lib/schemas";
import { tNow } from "@/lib/i18n/current";
import { destroyVault, loadDoc, openVault, saveDoc, unlock, type VaultKind } from "@/lib/vault";

export type RunLog = Run & { feature: string; ts: number };
export type SavedLetter = {
  id: string;
  title: string;
  deliveryDate: string;
  deadline: string | null;
  linkedTo: string[];
  explanation: string;
  draftLocal: string;
  draftUser: string;
  pages?: string[];
  extracted?: Letter;
};
export type Appointment = { date: string; purpose: string; office: string };
export type Dossier = {
  case: Case;
  sample: boolean;
  letters: SavedLetter[];
  nextAppointment?: Appointment;
  lastPreparedAt?: string;
  runs: RunLog[];
  onboarding?: { answers: Answers; reviews: Partial<Record<Need, Review>>; notes: Partial<Record<Need, string>>; results?: Pick<OnboardingDraft, "prepared" | "capture" | "interpretation" | "changes" | "updatesCheckedAt" | "link"> };
};

type Phase = "loading" | "locked" | "empty" | "ready" | "unavailable";
type Ctx = {
  phase: Phase;
  vaultKind: VaultKind | null;
  dossier: Dossier | null;
  me: AccountMe | null;
  status: Status | null;
  commitOwn(dossier: Dossier): Promise<void>;
  startSample(): Promise<void>;
  startOwn(name: string, language: Language, office: string): Promise<void>;
  update(fn: (d: Dossier) => Dossier): Promise<void>;
  logRuns(feature: string, runs: (Run | undefined)[]): void;
  unlockVault(): Promise<void>;
  refreshMe(): Promise<void>;
  wipe(): Promise<void>;
  setVaultKind(k: VaultKind): void;
};

const CaseContext = createContext<Ctx | null>(null);
const DOC = "dossier";

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [vaultKind, setVaultKind] = useState<VaultKind | null>(null);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [me, setMe] = useState<AccountMe | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const ref = useRef<Dossier | null>(null);

  const load = useCallback(async (accountId: string) => {
    const v = await openVault(accountId);
    if (v.status === "unavailable") return setPhase("unavailable");
    setVaultKind(v.kind);
    if (v.status === "locked") return setPhase("locked");
    const d = await loadDoc<Dossier>(DOC, accountId);
    ref.current = d;
    setDossier(d);
    setPhase(d ? "ready" : "empty");
  }, []);

  useEffect(() => {
    // Async initial load from the encrypted vault; state is set after the awaits resolve.
    void ensureSession().then((r) => {
      if (r.ok) { setMe(r.data); return load(r.data.accountId); }
      // Expired or invalid session: back to sign-in, then return here.
      if (r.status === 401) window.location.replace(signInUrl());
    });
    void api.status().then((r) => r.ok && setStatus(r.data));
    const t = setInterval(() => void api.status().then((r) => r.ok && setStatus(r.data)), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const persist = useCallback(async (d: Dossier) => {
    if (!me) throw new Error(tNow("shell")("noAccount"));
    await saveDoc(DOC, d, me.accountId);
    ref.current = d;
    setDossier(d);
    setPhase("ready");
  }, [me]);

  const value = useMemo<Ctx>(() => ({
    phase, vaultKind, dossier, me, status, setVaultKind,
    commitOwn: async (next) => {
      if (!me || next.sample || /sample/i.test(next.case.id)) throw new Error(tNow("shell")("ownCaseOnly"));
      CaseSchema.parse(next.case);
      if (ref.current && ref.current.case.id !== next.case.id) await saveDoc(`archive:${ref.current.case.id}`, ref.current, me.accountId);
      const switched = await startSession(false);
      if (!switched.ok) throw new Error(tNow("shell")("activateFailed"));
      setMe(switched.data);
      await persist(next);
    },
    startSample: async () => {
      const r = await startSession(true);
      if (r.ok) setMe(r.data);
      await persist({ case: sampleCase(), sample: true, letters: [], runs: [] });
    },
    startOwn: async (name, language, office) => {
      const r = await startSession(false);
      if (r.ok) setMe(r.data);
      await persist({ case: emptyCase(name, language, office), sample: false, letters: [], runs: [] });
    },
    update: async (fn) => {
      if (ref.current) await persist(fn(ref.current));
    },
    logRuns: (feature, runs) => {
      const cur = ref.current;
      if (!cur) return;
      const ts = Date.now();
      const add = runs.filter((r): r is Run => !!r).map((r) => ({ ...r, feature, ts }));
      if (add.length) void persist({ ...cur, runs: [...add, ...cur.runs].slice(0, 120) });
    },
    unlockVault: async () => {
      await unlock();
      if (me) await load(me.accountId);
    },
    refreshMe: async () => {
      const r = await api.me();
      if (r.ok) {
        if (me && me.accountId !== r.data.accountId) {
          ref.current = null;
          setDossier(null);
          setPhase("loading");
          await load(r.data.accountId);
        }
        setMe(r.data);
      }
    },
    wipe: async () => {
      await destroyVault();
      ref.current = null;
      setPhase("loading");
      setDossier(null);
      if (me) await load(me.accountId);
    },
  }), [phase, vaultKind, dossier, me, status, persist, load]);

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): Ctx {
  const c = useContext(CaseContext);
  if (!c) throw new Error("useCase outside CaseProvider");
  return c;
}

/** The dossier for screens that render only once a case exists (AppShell guarantees it). */
export function useDossier(): Dossier & { update: Ctx["update"]; logRuns: Ctx["logRuns"] } {
  const c = useCase();
  if (!c.dossier) throw new Error("No case loaded");
  return { ...c.dossier, update: c.update, logRuns: c.logRuns };
}

export const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
