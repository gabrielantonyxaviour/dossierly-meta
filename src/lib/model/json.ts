import type { ZodType } from "zod";
import { addUsage, emptyUsage } from "./cost";
import type { ChatClient, ChatMessage, ChatRequest, Usage } from "./types";
import { ModelError } from "./types";

/** Drop reasoning blocks and code fences, then take the outermost JSON object. */
export function extractJson(raw: string): unknown {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "");
  s = s.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in output");
  return JSON.parse(s.slice(start, end + 1));
}

export function parseModelOutput<T>(raw: string, schema: ZodType<T>): T {
  const parsed = schema.safeParse(extractJson(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue.path.join(".") || "output"}: ${issue.message}`);
  }
  return parsed.data;
}

export interface JsonCall<T> {
  data: T;
  raw: string;
  usage: Usage;
  attempts: number;
}

/** Call the model, validate against the schema; on failure retry once with the error, then fail clearly. */
export async function callJson<T>(client: ChatClient, req: ChatRequest, schema: ZodType<T>): Promise<JsonCall<T>> {
  let lastError = "";
  let lastRaw = "";
  let usage = emptyUsage();
  for (let attempt = 1; attempt <= 2; attempt++) {
    const messages: ChatMessage[] =
      attempt === 1
        ? req.messages
        : [
            ...req.messages,
            { role: "assistant", content: lastRaw.slice(0, 2000) || "(empty)" },
            {
              role: "user",
              content: `That was not valid. Problem: ${lastError}. Reply again with only the corrected JSON object, no commentary.`,
            },
          ];
    const res = await client.chat({ ...req, messages });
    usage = addUsage(usage, res.usage);
    lastRaw = res.content;
    try {
      return { data: parseModelOutput(res.content, schema), raw: res.content, usage, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unparseable";
    }
  }
  throw new ModelError(`Model output failed validation twice (${lastError})`, "invalid_output");
}
