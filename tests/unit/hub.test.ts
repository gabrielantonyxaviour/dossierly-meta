import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lexicalRank } from "@/lib/hub/rank";
import { cachedExtract, groundedSearch, htmlToText } from "@/lib/hub/search";
import { chunkText, normQuery, normUrl } from "@/lib/hub/util";
import { freshLocalEnv } from "@/lib/server/local";

describe("cache keys and chunking", () => {
  it("normalises queries and URLs so equivalent requests share a cache entry", () => {
    expect(normQuery("  Residence   CARD fingerprints ")).toBe("residence card fingerprints");
    expect(normUrl("https://Migrant.WSC.mazowieckie.pl/komunikaty/?utm_source=x#top")).toBe("https://migrant.wsc.mazowieckie.pl/komunikaty");
    expect(normUrl("https://migrant.wsc.mazowieckie.pl/komunikaty")).toBe(normUrl("https://migrant.wsc.mazowieckie.pl/komunikaty/"));
    expect(normUrl("https://a.pl/x?id=2")).not.toBe(normUrl("https://a.pl/x?id=3"));
  });
  it("splits long text on paragraph edges and drops fragments", () => {
    const para = "Odciski palców składa się osobiście w urzędzie wojewódzkim. ".repeat(8);
    const chunks = chunkText(`${para}\n\n${para}\n\n${para}\n\nOK`, 900);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.length <= 1000 && c.length > 40)).toBe(true);
    expect(chunks.join(" ")).not.toMatch(/\bOK$/);
  });
});

function stubFetch(handler: (url: string, body: Record<string, unknown> | null) => Response | null) {
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url, body });
    return handler(url, body) ?? new Response("nope", { status: 500 });
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

const searchReply = {
  output: [
    { type: "web_search_call" },
    {
      type: "message",
      content: [{
        type: "output_text",
        text: "The stamp duty for a residence card is 440 zł. Fingerprints are taken in person.",
        annotations: [{ type: "url_citation", url: "https://migrant.wsc.mazowieckie.pl/oplaty", title: "Opłaty", start_index: 0, end_index: 45 }],
      }],
    },
  ],
  usage: { input_tokens: 800, output_tokens: 120 },
};

describe("official pages", () => {
  it("converts html to readable text", () => {
    const t = htmlToText("<html><nav>Menu</nav><script>x()</script><p>Opłata wynosi 440&nbsp;zł</p><p>Odciski palców</p></html>");
    expect(t).toContain("Opłata wynosi 440 zł");
    expect(t).not.toMatch(/Menu|x\(\)/);
  });

  it("fetches an official page once, caches it, and ignores hosts outside the hub domains", async () => {
    const env = freshLocalEnv();
    const page = `<p>${"Odciski palców składa się osobiście w urzędzie wojewódzkim. ".repeat(6)}</p>`;
    const calls = stubFetch(() => new Response(page));
    const first = await cachedExtract(env, ["https://migrant.wsc.mazowieckie.pl/a", "https://evil.example.com/x"]);
    expect(first.origin).toBe("live");
    expect(first.pages.map((p) => p.url)).toEqual(["https://migrant.wsc.mazowieckie.pl/a"]);
    const again = await cachedExtract(env, ["https://migrant.wsc.mazowieckie.pl/a/"]);
    expect(again.origin).toBe("cache");
    expect(calls).toHaveLength(1);
  });
});

describe("grounded search", () => {
  it("calls the Responses API with the web_search tool, keeps only official citations, and caches", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const calls = stubFetch(() => Response.json(searchReply));
    const a = await groundedSearch(env, "Residence card   fee", { userId: "u1" });
    const b = await groundedSearch(env, "residence card fee", { userId: "u2" });
    expect(a.origin).toBe("live");
    expect(b.origin).toBe("cache");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.meta.ai/v1/responses");
    expect(calls[0].body?.tools).toEqual([{ type: "web_search" }]);
    expect(a.passages[0]).toMatchObject({ url: "https://migrant.wsc.mazowieckie.pl/oplaty" });
    expect(a.passages[0].text).toContain("440");
    const led = await env.DB.prepare("SELECT action, region FROM ledger WHERE kind = 'egress' ORDER BY seq").all<{ action: string; region: string }>();
    expect(led.results[0]).toEqual({ action: "allowed", region: "api.meta.ai" });
  });

  it("allows few live searches per user per day, then refuses without calling out", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const calls = stubFetch(() => Response.json(searchReply));
    for (let i = 0; i < 5; i++) expect((await groundedSearch(env, `query ${i}`, { userId: "u1" })).origin).toBe("live");
    expect((await groundedSearch(env, "one more", { userId: "u1" })).origin).toBe("budget");
    expect(calls).toHaveLength(5);
  });

  it("masks identifiers before they leave", async () => {
    const env = freshLocalEnv({ MODEL_API_KEY: "k" });
    const calls = stubFetch(() => Response.json(searchReply));
    await groundedSearch(env, "status of case WSC-II-P.6151.48213.2026 for 44051401359", { userId: "u1" });
    expect(JSON.stringify(calls[0].body)).not.toMatch(/48213|44051401359/);
  });

  it("does nothing live without a key", async () => {
    const calls = stubFetch(() => Response.json(searchReply));
    const r = await groundedSearch(freshLocalEnv({ MODEL_API_KEY: "" }), "anything");
    expect(r.origin).toBe("no_key");
    expect(calls).toHaveLength(0);
  });
});

describe("passage ranking", () => {
  const passages = [
    { id: "1", url: "https://gov.pl/1", title: "Fees", text: "The stamp duty fee for a residence card is 440 zł." },
    { id: "2", url: "https://gov.pl/2", title: "Fingerprints", text: "Fingerprints are taken in person at the voivodeship office." },
    { id: "3", url: "https://gov.pl/3", title: "Other", text: "Weather and holidays." },
  ];
  it("ranks by keyword overlap", () => {
    const r = lexicalRank("fingerprints at the voivodeship office", passages, 1);
    expect(r[0].id).toBe("2");
  });
});
