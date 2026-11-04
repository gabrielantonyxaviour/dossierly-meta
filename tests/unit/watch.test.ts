import { describe, expect, it } from "vitest";
import { diffLines, runNightlyWatch } from "@/lib/hub/watch";
import { listChanges } from "@/lib/hub/store";
import type { ChatClient, ChatRequest } from "@/lib/model/types";
import { freshLocalEnv } from "@/lib/server/local";

const URL_LIST = "https://migrant.wsc.mazowieckie.pl/komunikaty";
const URL_FEES = "https://migrant.wsc.mazowieckie.pl/wskazowki/oplaty";

function fake(reply: object) {
  const calls: ChatRequest[] = [];
  const client: ChatClient = {
    async chat(r) {
      calls.push(r);
      return { content: JSON.stringify(reply), usage: { tokensIn: 10, tokensOut: 5, cachedTokens: 0 } };
    },
  };
  return { client, calls };
}

describe("diffLines", () => {
  it("returns added and removed lines only", () => {
    expect(diffLines("alpha\nbravo\ncharlie", "bravo\ncharlie\ndelta")).toEqual({ added: ["delta"], removed: ["alpha"] });
  });
});

describe("runNightlyWatch", () => {
  const env = () => freshLocalEnv({ MODEL_API_KEY: "k" });

  it("reads an announcements listing on first sight, attaches the verified listing date, uses the draft role", async () => {
    const e = env();
    const { client, calls } = fake({
      changes: [{ title: "Legal stay confirmation replaces passport stamp", summary: "A certificate (zaświadczenie) replaces the stamp in the passport.", date: null }],
    });
    const r = await runNightlyWatch(e, { pages: [{ url: URL_LIST, text: "## Potwierdzenie legalnego pobytu\nZaświadczenie" }], client });
    expect(r.changed).toBe(1);
    expect(calls[0].role).toBe("draft");
    expect(calls[0].model).toBe("muse-spark-1.3");
    const rows = await listChanges(e, "pl");
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toMatch(/Listed 2026-10-19/);
    expect(rows[0].sample).toBe(false);
  });

  it("only baselines a static page on first sight, then reports a real diff", async () => {
    const e = env();
    const { client, calls } = fake({ changes: [{ title: "Card fee changed", summary: "The card fee is now 120 zł.", date: null }] });
    const first = await runNightlyWatch(e, { pages: [{ url: URL_FEES, text: "Karta 100 zł\nPermit 440 zł" }], client });
    expect(first.newChanges).toHaveLength(0);
    expect(calls).toHaveLength(0);
    const same = await runNightlyWatch(e, { pages: [{ url: URL_FEES, text: "Karta 100 zł\nPermit 440 zł" }], client });
    expect(same.unchanged).toBe(1);
    expect(calls).toHaveLength(0);
    const changed = await runNightlyWatch(e, { pages: [{ url: URL_FEES, text: "Karta 120 zł\nPermit 440 zł" }], client });
    expect(changed.newChanges).toHaveLength(1);
    expect(String(calls[0].messages[1].content)).toContain("Karta 120 zł");
    expect(String(calls[0].messages[1].content)).toContain("REMOVED LINES:\nKarta 100 zł");
  });

  it("does not duplicate a change it already recorded", async () => {
    const e = env();
    const { client } = fake({ changes: [{ title: "Same item", summary: "x", date: null }] });
    await runNightlyWatch(e, { pages: [{ url: URL_LIST, text: "one" }], client });
    await runNightlyWatch(e, { pages: [{ url: URL_LIST, text: "one two" }], client });
    expect(await listChanges(e, "pl")).toHaveLength(1);
  });
});
