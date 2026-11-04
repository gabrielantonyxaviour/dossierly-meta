import { ZodError } from "zod";
import { CaseError, type CaseStore } from "./store";
import { collectionSchema } from "./types";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const err = (status: number, error: string, code: string) => json({ error, code }, status);

/**
 * Pure request router for CaseDO (testable without Workers):
 *  GET /snapshot | PATCH /profile | PATCH /facts
 *  GET|POST /<collection> | PATCH|DELETE /<collection>/<id>
 */
export async function handleCaseRequest(store: CaseStore, req: Request): Promise<Response> {
  try {
    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const [head, id] = parts;
    const m = req.method;
    const body = async () => {
      try {
        return await req.json();
      } catch {
        throw new CaseError(400, "Request body must be JSON", "invalid_json");
      }
    };
    if (m === "GET" && head === "snapshot") return json(store.snapshot());
    if (m === "PATCH" && head === "profile") return json(store.patchProfile(await body()));
    if (m === "PATCH" && head === "facts") return json(store.patchFacts(await body()));
    const kind = collectionSchema.safeParse(head);
    if (!kind.success) return err(404, "Not found", "not_found");
    if (!id && m === "GET") return json(store.list(kind.data));
    if (!id && m === "POST") return json(store.create(kind.data, await body()), 201);
    if (id && m === "GET") {
      const item = store.get(kind.data, id);
      return item ? json(item) : err(404, "Item not found", "not_found");
    }
    if (id && m === "PATCH") return json(store.patch(kind.data, id, await body()));
    if (id && m === "DELETE") {
      store.remove(kind.data, id);
      return json({ ok: true });
    }
    return err(405, "Method not allowed", "method_not_allowed");
  } catch (e) {
    if (e instanceof CaseError) return err(e.status, e.message, e.code);
    if (e instanceof ZodError) return err(400, "Invalid request", "invalid_request");
    return err(500, "Something went wrong on our side", "internal");
  }
}
