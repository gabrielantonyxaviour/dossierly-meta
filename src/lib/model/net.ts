import type { ContentOrigin } from "../config";
import type { EnvLike } from "./roles";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface MetaOpts {
  env?: EnvLike;
  fetch?: FetchLike;
  timeoutMs?: number;
  /** Where the content came from; absent means "user" (fail closed, see gate.ts). Request `origin` wins for chat. */
  origin?: ContentOrigin;
}

export const doFetch = (o: MetaOpts): FetchLike => o.fetch ?? ((u, i) => fetch(u, i));

/** `data:` payloads of a server-sent-events body (`[DONE]` skipped). */
export async function* sseData(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  }
  const tail = buf.trim();
  if (tail.startsWith("data:") && tail.slice(5).trim() !== "[DONE]") yield tail.slice(5).trim();
}
