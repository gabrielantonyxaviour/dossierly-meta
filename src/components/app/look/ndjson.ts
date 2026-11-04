/** Reads an NDJSON (one JSON object per line) response body and hands each event to `onEvent`. */
export async function readNdjson<T>(res: Response, onEvent: (e: T) => void, signal?: AbortSignal): Promise<void> {
  if (!res.body) throw new Error("The server sent an empty reply.");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const flush = (line: string) => {
    const t = line.trim();
    if (!t) return;
    try {
      onEvent(JSON.parse(t) as T);
    } catch {
      /* ignore a malformed keep-alive line */
    }
  };
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      flush(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  flush(buf);
}

/** Turns a non-2xx JSON `{ error, code }` reply into a readable message. */
export async function errorText(res: Response): Promise<{ message: string; code?: string }> {
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (res.status === 401) return { message: "Your session has ended. Sign in again to continue.", code: "no_session" };
  if (res.status === 429) return { message: body?.error ?? "That was a lot of requests at once. Wait a minute and try again.", code: "rate_limited" };
  return { message: body?.error ?? "Something went wrong on our side. Try again.", code: body?.code };
}
