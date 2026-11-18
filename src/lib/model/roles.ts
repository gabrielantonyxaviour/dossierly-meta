import {
  ANTHROPIC_BASE_URL, ELEVENLABS_BASE_URL, META_BASE_URL, MODEL_ASR, MODEL_SAM, ROLE_DEFAULTS, USER_ROLE_DEFAULTS, USER_TASK_MODEL,
  type ContentOrigin, type ModelTask, type Provider, type ReasoningEffort, type Role, type Route,
} from "../config";
import { assertProviderAllowed, normaliseOrigin, providerAllowed } from "./gate";

export type EnvLike = object | undefined;
export type Service = "sam" | "asr" | "search";

export interface RoleConfig {
  /** Role or service this config was resolved for. */
  name: Role | Service;
  provider: Provider;
  /** Origin this config was resolved (and gated) for. */
  origin: ContentOrigin;
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

/** First non-empty of MODEL_<ROLE>_<scope>_<name>, then MODEL_<ROLE>_<name>. scope is USER or DEMO. */
function pick(env: EnvLike, up: string, scope: string, name: string): string {
  return read(env, `MODEL_${up}_${scope}_${name}`) || read(env, `MODEL_${up}_${name}`);
}

/** claude-* ids run on Anthropic; muse-*, sam-* and anything else on the Meta-compatible API. */
const providerOfModel = (model: string): Provider => (/^claude-/i.test(model) ? "anthropic" : "meta");

function defaultsFor(role: Role | Service, origin: ContentOrigin): Route {
  if (role === "sam") return { provider: "meta", model: MODEL_SAM, effort: "minimal" };
  if (role === "asr") return { provider: "elevenlabs", model: MODEL_ASR, effort: "minimal" };
  if (role === "search") return origin === "user" ? { provider: "anthropic", model: "claude-sonnet-5-5", effort: "low" } : { provider: "meta", model: ROLE_DEFAULTS.agent.model, effort: "low" };
  return origin === "user" ? USER_ROLE_DEFAULTS[role] : { provider: "meta", ...ROLE_DEFAULTS[role] };
}

/**
 * Provider, base URL, model and key for one role, for one content origin. Routing is config only:
 *   MODEL_<ROLE>_PROVIDER = meta | anthropic      (anything else is ignored; the model id's prefix decides)
 *   MODEL_<ROLE>_MODEL, _EFFORT, _BASE_URL, _KEY_ENV (the NAME of the env var holding that role's key)
 * Real-user calls read MODEL_<ROLE>_USER_<X> first and demo/eval calls MODEL_<ROLE>_DEMO_<X>, so the two can be
 * routed apart. Defaults: user content to Claude, demo/eval to Meta (config.ts). The key defaults to
 * ANTHROPIC_API_KEY for Anthropic and MODEL_API_KEY for Meta.
 *
 * This is also the gate: a Meta route for "user" content (the default when origin is missing) throws
 * ModelError "provider_blocked" unless META_USER_CONTENT=allow. sam is a Meta-only service, search follows config (Claude for user content, Meta for demo/eval); asr is ElevenLabs only
 * (key ELEVENLABS_API_KEY, model MODEL_ASR_MODEL), so it is never gated.
 */
export function resolveRole(role: Role | Service, env?: EnvLike, origin?: ContentOrigin, task?: ModelTask): RoleConfig {
  const cfg = peekRole(role, env, origin, task);
  assertProviderAllowed(cfg.provider, cfg.origin, env);
  return { ...cfg, apiKey: read(env, cfg.apiKey) };
}

/** The same resolution without the gate and with the key blanked: for status pages and "is a model configured" checks. Never use it to make a call. */
export function describeRole(role: Role | Service, env?: EnvLike, origin?: ContentOrigin, task?: ModelTask): RoleConfig & { blocked: boolean; hasKey: boolean } {
  const cfg = peekRole(role, env, origin, task);
  return { ...cfg, apiKey: "", blocked: !providerAllowed(cfg.provider, cfg.origin, env), hasKey: !!read(env, cfg.apiKey) };
}

/** Internal: apiKey carries the NAME of the key variable until resolveRole reads it. */
function peekRole(role: Role | Service, env: EnvLike, originIn: ContentOrigin | undefined, task: ModelTask | undefined): RoleConfig {
  const origin = normaliseOrigin(originIn);
  const up = role.toUpperCase();
  const scope = origin === "user" ? "USER" : "DEMO";
  const d = defaultsFor(role, origin);
  const service = role === "sam" || role === "asr" || role === "search";
  const modelEnv = pick(env, up, scope, "MODEL");
  const explicit = pick(env, up, scope, "PROVIDER").toLowerCase();
  // asr is ElevenLabs for EVERY origin and cannot be re-pointed: real-user audio never reaches Meta. sam stays Meta-only.
  const provider: Provider = role === "asr" ? "elevenlabs" : role === "sam" ? "meta"
    : explicit === "meta" || explicit === "anthropic" ? explicit
    : modelEnv ? providerOfModel(modelEnv)
    : d.provider;
  const taskModel = origin === "user" && !service && provider === "anthropic" ? USER_TASK_MODEL[task as ModelTask] : undefined;
  // A provider chosen without a model gets that provider's default model for the role.
  const providerDefault = provider === d.provider ? d.model : provider === "anthropic" ? USER_ROLE_DEFAULTS[(role === "search" ? "agent" : role) as Role].model : ROLE_DEFAULTS[(role === "search" ? "agent" : role) as Role].model;
  const effort = pick(env, up, scope, "EFFORT");
  if (provider === "elevenlabs") {
    return {
      name: role, provider, origin,
      baseUrl: (read(env, "ELEVENLABS_BASE_URL") || ELEVENLABS_BASE_URL).replace(/\/+$/, ""),
      model: /^scribe_/.test(modelEnv) ? modelEnv : d.model, // a non-Scribe id (e.g. a Meta one) is ignored
      apiKey: "ELEVENLABS_API_KEY",
      effort: d.effort,
    };
  }
  const baseUrl = pick(env, up, scope, "BASE_URL") || (provider === "meta" ? read(env, "MODEL_BASE_URL") : "") || (provider === "anthropic" ? ANTHROPIC_BASE_URL : META_BASE_URL);
  return {
    name: role,
    provider,
    origin,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model: modelEnv || taskModel || providerDefault,
    apiKey: pick(env, up, scope, "KEY_ENV") || (provider === "anthropic" ? "ANTHROPIC_API_KEY" : "MODEL_API_KEY"),
    effort: EFFORTS.has(effort) ? (effort as ReasoningEffort) : d.effort,
  };
}

/** True when a model key is reachable for the default role, for real-user calls unless an origin is given. */
export const hasModelKey = (env?: EnvLike, origin?: ContentOrigin): boolean => describeRole("agent", env, origin).hasKey;
