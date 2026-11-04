import { META_BASE_URL, MODEL_ASR, MODEL_SAM, ROLE_DEFAULTS, type ReasoningEffort, type Role } from "../config";

export type EnvLike = object | undefined;
export type Service = "sam" | "asr" | "search";

export interface RoleConfig {
  /** Role or service this config was resolved for. */
  name: Role | Service;
  baseUrl: string;
  model: string;
  /** Empty when no key is configured. */
  apiKey: string;
  effort: ReasoningEffort;
}

const EFFORTS = new Set<string>(["minimal", "low", "medium", "high"]);

function read(env: EnvLike, key: string): string {
  const fromEnv = (env as Record<string, unknown> | undefined)?.[key];
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim();
  const p = typeof process !== "undefined" ? process.env?.[key] : undefined;
  return typeof p === "string" ? p.trim() : "";
}

/**
 * Base URL, model and key for one role. Defaults point at the Meta Model API with MODEL_API_KEY. Set
 * MODEL_<ROLE>_BASE_URL / MODEL_<ROLE>_MODEL / MODEL_<ROLE>_KEY_ENV (the NAME of the env var holding that
 * role's key) / MODEL_<ROLE>_EFFORT to move one role to any OpenAI-compatible host with no code change.
 */
export function resolveRole(role: Role | Service, env?: EnvLike): RoleConfig {
  const up = role.toUpperCase();
  const defaults =
    role === "sam" ? { model: MODEL_SAM, effort: "minimal" as const }
    : role === "asr" ? { model: MODEL_ASR, effort: "minimal" as const }
    : role === "search" ? { model: ROLE_DEFAULTS.agent.model, effort: "low" as const }
    : ROLE_DEFAULTS[role];
  const keyEnv = read(env, `MODEL_${up}_KEY_ENV`) || "MODEL_API_KEY";
  const effort = read(env, `MODEL_${up}_EFFORT`);
  return {
    name: role,
    baseUrl: (read(env, `MODEL_${up}_BASE_URL`) || read(env, "MODEL_BASE_URL") || META_BASE_URL).replace(/\/+$/, ""),
    model: read(env, `MODEL_${up}_MODEL`) || defaults.model,
    apiKey: read(env, keyEnv),
    effort: EFFORTS.has(effort) ? (effort as ReasoningEffort) : defaults.effort,
  };
}

/** True when any model key is reachable for the default role. */
export const hasModelKey = (env?: EnvLike): boolean => !!resolveRole("agent", env).apiKey;
