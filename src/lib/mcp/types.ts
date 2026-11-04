import type { ZodType } from "zod";
import type { ChatClient } from "../model/types";
import type { Env } from "../server/env";
import type { McpScope, TokenPrincipal } from "./tokens";

/** Test seams: production passes none and the real Meta client / global fetch are used. */
export interface McpDeps {
  client?: ChatClient;
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
}

export interface ToolContext {
  env: Env;
  principal: TokenPrincipal;
  deps: McpDeps;
}

/** An honest, structured tool failure: `{ error, code }` in the tool result with isError set. */
export class McpToolError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  /** "read" tools run on any token; "act" tools write to the case and need an act-scope token. */
  scope: McpScope;
  /** Calls a Meta model (rate-limited harder). */
  usesModel?: boolean;
  input: ZodType<Record<string, unknown>>;
  run(args: never, ctx: ToolContext): Promise<unknown>;
}
