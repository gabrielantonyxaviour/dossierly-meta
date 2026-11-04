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
  | "prepare";

export type Role = "interpret" | "guard" | "reason" | "agent" | "vision" | "draft";
export const ROLES: readonly Role[] = ["interpret", "guard", "reason", "agent", "vision", "draft"];
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export const META_BASE_URL = "https://api.meta.ai/v1";

/** Default model and reasoning effort per role. Override per role with MODEL_<ROLE>_MODEL / _BASE_URL / _KEY_ENV. */
export const ROLE_DEFAULTS: Record<Role, { model: string; effort: ReasoningEffort }> = {
  interpret: { model: "muse-spark-1.2", effort: "minimal" },
  guard: { model: "muse-spark-1.2", effort: "minimal" },
  reason: { model: "muse-spark-1.3", effort: "medium" },
  agent: { model: "muse-spark-1.3", effort: "low" },
  vision: { model: "muse-spark-1.3", effort: "low" },
  draft: { model: "muse-spark-1.3", effort: "low" },
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
};

export const MODEL_SAM = "sam-3.1";
export const MODEL_ASR = "muse-voice-transcribe-1.0";

/** List prices, USD per million tokens: input, cached input, output. Spark 1.2 and 1.3 share them. */
export const SPARK_PRICE = { in: 1.25, cached: 0.15, out: 4.25 } as const;
export const PRICES: Record<string, { in: number; cached: number; out: number }> = {
  "muse-spark-1.3": SPARK_PRICE,
  "muse-spark-1.2": SPARK_PRICE,
};
/** Per-unit prices for the non-token products. */
export const SAM_USD_PER_IMAGE = 2.5 / 1000;
export const ASR_USD_PER_HOUR = 0.18;
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
