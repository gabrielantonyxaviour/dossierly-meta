export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatRequest {
  /** Resolved model id (from the role). */
  model: string;
  /** Selects base URL and key at call time; absent means the default role. */
  role?: import("../config").Role;
  messages: ChatMessage[];
  /** Reasoning tokens count against this cap, so keep it generous (>=1500; >=4000 for vision). */
  maxTokens: number;
  reasoningEffort?: import("../config").ReasoningEffort;
  /** "json_object" or a JSON schema for response_format: json_schema. */
  json?: "json_object" | Record<string, unknown>;
  temperature?: number;
}

export interface Usage {
  tokensIn: number;
  tokensOut: number;
  cachedTokens: number;
}

export interface ChatResult {
  content: string;
  usage: Usage;
}

/** The only surface the features depend on. The Meta provider and test doubles implement it. */
export interface ChatClient {
  chat(req: ChatRequest): Promise<ChatResult>;
}

export type ModelErrorCode =
  | "no_key"
  | "provider_unavailable"
  | "rate_limited"
  | "model_error"
  | "model_unavailable"
  | "invalid_output"
  | "over_budget"
  | "models_disabled"
  | "bad_request";

export class ModelError extends Error {
  constructor(
    message: string,
    readonly code: ModelErrorCode,
    readonly status: number = 502,
    /** Tokens the provider billed before the call failed (an empty reply); the meter settles to these. */
    readonly usage?: Usage,
  ) {
    super(message);
    this.name = "ModelError";
  }
}
