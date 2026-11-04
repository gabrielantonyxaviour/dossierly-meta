import { ModelError } from "../model";

const TRANSIENT = new Set(["model_unavailable", "model_error", "rate_limited"]);

/** One quiet retry for a brief provider hiccup (Meta returns a short-lived 404/5xx/429 under load). */
export async function retryTransient<T>(fn: () => Promise<T>, waitMs = 1500): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof ModelError) || !TRANSIENT.has(e.code)) throw e;
    await new Promise((r) => setTimeout(r, waitMs));
    return fn();
  }
}
