import { DurableObject } from "cloudflare:workers";
import { handleCaseRequest } from "../src/lib/case/handler";
import { CaseStore } from "../src/lib/case/store";

/** One per user (idFromName(userId)): the server-side case in SQLite. Logic lives in src/lib/case. */
export class CaseDO extends DurableObject<Record<string, unknown>> {
  private store: CaseStore;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    this.store = new CaseStore({ exec: (q, ...b) => ctx.storage.sql.exec(q, ...b).toArray() as never });
  }

  fetch(request: Request): Promise<Response> {
    return handleCaseRequest(this.store, request);
  }
}
