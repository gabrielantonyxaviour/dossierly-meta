/* Case access from inside VoiceDO: talks to the user's CaseDO through the binding, same routes as src/lib/case/client. */
import type { CaseDocument, CaseSnapshot, CaseTask, Deadline, CaseEvent } from "../../case/types";

export interface CaseNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> };
}

export class VoiceCase {
  private snap: CaseSnapshot | null = null;

  constructor(private ns: CaseNamespace | undefined, private userId: string) {}

  private async call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    if (!this.ns) throw new Error("Case storage is unavailable");
    const stub = this.ns.get(this.ns.idFromName(this.userId));
    const res = await stub.fetch(`https://case.do/${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Case request failed");
    return data;
  }

  async snapshot(refresh = false): Promise<CaseSnapshot> {
    if (!this.snap || refresh) this.snap = await this.call<CaseSnapshot>("snapshot");
    return this.snap;
  }

  get cached(): CaseSnapshot | null {
    return this.snap;
  }

  async addTask(input: { title: string; detail?: string; origin: CaseTask["origin"]; dueDeadlineId?: string | null }): Promise<CaseTask> {
    const t = await this.call<CaseTask>("tasks", "POST", { status: "open", ...input });
    this.snap?.tasks.push(t);
    return t;
  }

  async addDeadline(input: { title: string; dueDate: string; steps: string[]; rule?: string | null }): Promise<Deadline> {
    const d = await this.call<Deadline>("deadlines", "POST", {
      title: input.title,
      dueDate: input.dueDate,
      computation: { steps: input.steps, rule: input.rule ?? null, legalRefUrl: null },
    });
    this.snap?.deadlines.push(d);
    return d;
  }

  async addEvent(input: { type: CaseEvent["type"]; summary: string; refs?: string[] }): Promise<CaseEvent | null> {
    try {
      return await this.call<CaseEvent>("events", "POST", { type: input.type, summary: input.summary.slice(0, 600), refs: (input.refs ?? []).slice(0, 20) });
    } catch {
      return null;
    }
  }

  async markDocument(id: string, status: CaseDocument["status"]): Promise<void> {
    await this.call(`documents/${encodeURIComponent(id)}`, "PATCH", { status }).catch(() => undefined);
  }
}
