import type { Language } from "./schemas";

/** Every model task; each maps to one role (below), and each role to one Meta Model API model. */
export type ModelTask =
  | "intro"
  | "interpret"
  | "interpret_ml"
  | "guard_ml"
  | "guard"
  | "watch"
  | "wrap"
  | "read"
  | "link"
  | "link_fallback"
  | "hub_summary"
  | "prepare"
  | "mail_scan"
  | "welcome"
  | "intake";

export type Role = "interpret" | "guard" | "reason" | "agent" | "vision" | "draft";
export const ROLES: readonly Role[] = ["interpret", "guard", "reason", "agent", "vision", "draft"];
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export const META_BASE_URL = "https://api.meta.ai/v1";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

/** Who provides a model. Routing is per role and per content origin (see resolveRole). */
export type Provider = "meta" | "anthropic" | "elevenlabs";
/**
 * Where the content of a call came from. "user" is a real person's letters, photos, messages, voice or case data;
 * "demo" is the fictional demo persona and generated sample letters; "eval" is the evaluation harness.
 * Anything not explicitly demo or eval is "user" (fail closed).
 */
export type ContentOrigin = "user" | "demo" | "eval";
export interface Route { provider: Provider; model: string; effort: ReasoningEffort }

/** Default model and reasoning effort per role. Override per role with MODEL_<ROLE>_MODEL / _BASE_URL / _KEY_ENV. */
export const ROLE_DEFAULTS: Record<Role, { model: string; effort: ReasoningEffort }> = {
  interpret: { model: "muse-spark-1.2", effort: "minimal" },
  guard: { model: "muse-spark-1.2", effort: "minimal" },
  reason: { model: "muse-spark-1.3", effort: "medium" },
  agent: { model: "muse-spark-1.3", effort: "low" },
  vision: { model: "muse-spark-1.3", effort: "low" },
  draft: { model: "muse-spark-1.3", effort: "low" },
};

/**
 * Defaults for REAL users' content. Meta's promotional credits let Meta use content for product improvement, so
 * nothing a real user provides goes to Meta until META_USER_CONTENT=allow (src/lib/model/gate.ts). Switch any role
 * back with MODEL_<ROLE>_USER_PROVIDER / _USER_MODEL, no code change.
 */
export const USER_ROLE_DEFAULTS: Record<Role, Route> = {
  interpret: { provider: "anthropic", model: "claude-haiku-5-5", effort: "minimal" },
  guard: { provider: "anthropic", model: "claude-haiku-5-5", effort: "minimal" },
  reason: { provider: "anthropic", model: "claude-sonnet-5-5", effort: "medium" },
  agent: { provider: "anthropic", model: "claude-sonnet-5-5", effort: "low" },
  vision: { provider: "anthropic", model: "claude-sonnet-5-5", effort: "low" },
  draft: { provider: "anthropic", model: "claude-sonnet-5-5", effort: "low" },
};

/** Tasks that route to a different role's user default (watch/triage classification is Haiku work). */
export const USER_TASK_MODEL: Partial<Record<ModelTask, string>> = {
  hub_summary: "claude-haiku-5-5",
  watch: "claude-haiku-5-5",
};

export const TASK_ROLE: Record<ModelTask, Role> = {
  intro: "draft",
  interpret: "interpret",
  interpret_ml: "interpret",
  guard: "guard",
  guard_ml: "guard",
  hub_summary: "draft",
  watch: "draft",
  wrap: "draft",
  read: "vision",
  prepare: "agent",
  link: "reason",
  link_fallback: "draft",
  mail_scan: "reason",
  welcome: "draft",
  intake: "interpret",
};

export const MODEL_SAM = "sam-3.1";
/*
 * Speech is ElevenLabs only (Meta never receives real-user audio). Scribe v3 Live streams (Counter, Talk, phone);
 * Scribe v3 transcribes recorded clips (/api/asr). Override per Worker with MODEL_ASR_MODEL / MODEL_ASR_BATCH_MODEL.
 * Ids and protocol: https://elevenlabs.io/docs/overview/models and
 * https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime
 */
export const MODEL_ASR = "scribe_v3_live";
export const MODEL_ASR_BATCH = "scribe_v3";
export const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
/** Text to speech: v4 Turbo is ElevenLabs' real-time v4 model (~100 ms); `eleven_v4` is the highest-quality, slower one. */
export const MODEL_TTS = "eleven_v4_turbo";
/** Premade voices. Sarah: "Mature, Reassuring, Confident", premade (so always on the account), multilingual. */
export const VOICE_ID_DEFAULT = "EXAVITQu4vr4xnSDxMaL";
/** The Polish official at the counter / rehearsal: Alex, a professional native Polish male voice. */
export const VOICE_ID_OFFICIAL = "H5xTcsAIeS5RAykjz57a";
/** Hard daily ceiling on ElevenLabs TTS characters (the plan has no headroom; ELEVENLABS_DAILY_CHAR_CAP overrides). */
export const ELEVENLABS_DAILY_CHAR_CAP = 4000;

/** List prices, USD per million tokens: input, cached input, output. Spark 1.2 and 1.3 share them. */
export const SPARK_PRICE = { in: 1.25, cached: 0.15, out: 4.25 } as const;
export const PRICES: Record<string, { in: number; cached: number; out: number }> = {
  "muse-spark-1.3": SPARK_PRICE,
  "muse-spark-1.2": SPARK_PRICE,
  /* Anthropic list prices from the pinned claude-api skill (2026-11-18); cached = cache-read rate (0.1x input for
     Haiku is assumed, UNVERIFIED; Sonnet and Opus cache reads are listed). Haiku 5.5 over 100K prompt tokens bills
     $0.50 / $2.50, not modelled (no prompt here comes near it). */
  "claude-haiku-5-5": { in: 0.1, cached: 0.01, out: 0.5 },
  "claude-sonnet-5-5": { in: 2, cached: 0.2, out: 10 },
  "claude-opus-5-5": { in: 4, cached: 0.2, out: 20 },
};
/** Per-unit prices for the non-token products. */
export const SAM_USD_PER_IMAGE = 2.5 / 1000;
/** Scribe list price per hour of audio (ElevenLabs API pricing; UNVERIFIED for v3, used only for the model-spend cap). */
export const ASR_USD_PER_HOUR = 0.4;
export const SEARCH_USD_PER_CALL = 2.5 / 1000;

export const LANGUAGE_META: Record<
  Language,
  { label: string; native: string; english: string; recognition: string; speech: string }
> = {
  en: { label: "English", native: "English", english: "English", recognition: "en-IN", speech: "en-IN" },
  uk: { label: "Ukrainian", native: "Українська", english: "Ukrainian", recognition: "uk-UA", speech: "uk-UA" },
  hi: { label: "Hindi", native: "हिन्दी", english: "Hindi", recognition: "hi-IN", speech: "hi-IN" },
  ta: { label: "Tamil", native: "தமிழ்", english: "Tamil", recognition: "ta-IN", speech: "ta-IN" },
  ru: { label: "Russian", native: "Русский", english: "Russian", recognition: "ru-RU", speech: "ru-RU" },
  zh: { label: "Chinese", native: "中文", english: "Chinese", recognition: "zh-CN", speech: "zh-CN" },
  ja: { label: "Japanese", native: "日本語", english: "Japanese", recognition: "ja-JP", speech: "ja-JP" },
  vi: { label: "Vietnamese", native: "Tiếng Việt", english: "Vietnamese", recognition: "vi-VN", speech: "vi-VN" },
};

export const POLISH = { recognition: "pl-PL", speech: "pl-PL" };

/** Official domains the grounded web search is told to prefer. */
export const HUB_DOMAINS = [
  "gov.pl",
  "udsc.gov.pl",
  "migrant.wsc.mazowieckie.pl",
  "mazowieckie.uw.gov.pl",
  "mos.cudzoziemcy.gov.pl",
];

export const HUB_LIMITS = {
  searchesPerDay: 10,
  kvTtlSeconds: 7 * 24 * 3600,
  /** The demo set (sources.json + demo queries) is cached with no TTL. */
  topK: 12,
  chunkChars: 900,
};
