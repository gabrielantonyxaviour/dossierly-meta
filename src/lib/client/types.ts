import type { Case, Language, Letter, TurnInput } from "@/lib/schemas";

export type { Case, Language, Letter, TurnInput };
export type CaseEvent = Case["events"][number];
export type CaseDeadline = Case["deadlines"][number];

export type RanOn = "cloud" | "sandbox" | "replay";
export type Run = {
  model: string;
  ms: number;
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
  costUsd: number;
  ranOn: RanOn;
};

export type PlanKind = "free" | "one_case" | "household_year" | "judge";
export type Plan = { kind: PlanKind; creditsLeft: number; expiresAt?: string | null; family?: boolean };
export type Me = {
  userId: string; plan: Plan; freeLetterUsed: boolean;
  planChosen?: boolean; lettersUsed?: number; freeLetters?: number; activeCase?: "own" | "sample"; accountKind?: "email" | "passkey" | "device";
};

export type Status = {
  models: { id: string; role: string; ready: boolean }[];
  bridge: { online: boolean; lastSeen: string | null; sandboxes: number };
  budgets?: unknown;
  asr?: { online: boolean; model: string };
};

export type Intro = { local: string; english: string; masked?: number; run: Run };
export type Interpretation = { translation: string; adviceNotice: string | null; masked: number; run: Run };
export type Issue = {
  kind: "date" | "amount" | "document" | "yes_no" | "missed_question" | "other";
  quote: string;
  explanation: string;
  clarifyLocal: string;
  clarifyUser: string;
};
export type WatchResult = { issues: Issue[]; run: Run };
export type Wrap = {
  headline: string;
  agreed: string[];
  bring: string[];
  nextDates: { date: string; what: string }[];
  openQuestions: string[];
};
export type WrapResult = { summary: Wrap; run: Run };

export type LetterRead = { letter: Letter; run: Run; runs?: Run[] };
export type Deadline = { date: string; steps: string[] };
export type LetterLink = {
  link: { relatedEventIds: string[]; explanation: string; stillOpen: string[] };
  deadline: Deadline | null;
  draftLocal: string;
  draftUser: string;
  run?: Run;
  runs: Run[];
  fallbackLabel?: string;
};

export type Citation = { url: string; title: string; quote: string };
export type ChecklistItem = { item: string; status: "have" | "missing" | "check"; citation: Citation };
export type HubChange = { title: string; summary: string; url: string; detectedAt: string };
export type PrepareResult = { checklist: ChecklistItem[]; phrases: { local: string; user: string }[]; changes: HubChange[] };
export type TraceStep = { step: string; tool?: string; ms: number };
export type AgentTask<R = unknown> = {
  id: string;
  kind: "prepare" | "ask" | "file";
  status: "queued" | "running" | "done" | "failed";
  ranOn: "cloud" | "sandbox" | null;
  sandbox?: string;
  trace: TraceStep[];
  result?: R;
  run?: Run;
  error?: string;
};

export type LedgerEntry = {
  seq: number;
  ts: number;
  kind: "model" | "egress" | "job";
  what: string;
  region?: string;
  action?: "allowed" | "denied";
  bytes?: number;
  masked?: number;
  prevHash: string;
  hash: string;
};
export type Ledger = { entries: LedgerEntry[]; root: string; verified: boolean };

export type Product = "case_pass" | "credits_10" | "credits_25" | "family";
