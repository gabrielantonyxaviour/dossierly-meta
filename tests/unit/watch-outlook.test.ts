import { afterEach, describe, expect, it, vi } from "vitest";
import { looksOfficial, listOutlookIds, normaliseOutlook } from "../../src/lib/watch/outlook";
import type { AccountRow, ConnectionsEnv } from "../../src/lib/server/connections/types";

afterEach(() => vi.unstubAllGlobals());
describe("Outlook mail for the watcher", () => {
  it("normalises a Graph message into the watcher's message shape", () => {
    const b = normaliseOutlook("AAMk1", "2026-11-04T09:30:00Z", { messageId: "AAMk1", subject: "", from: "wsc@mazowieckie.example", text: "x".repeat(20_000), attachments: [{ id: "a1", name: "letter.pdf", mime: "application/pdf", size: 1200 }] }, ["data:image/png;base64,AA"]);
    expect(b).toMatchObject({ id: "AAMk1", subject: "(no subject)", from: "wsc@mazowieckie.example", receivedAt: "2026-11-04T09:30:00.000Z", attachments: [{ id: "a1", name: "letter.pdf" }], images: ["data:image/png;base64,AA"] });
    expect(b.text).toHaveLength(12_000);
    expect(normaliseOutlook("i", "garbage", { subject: "s", from: "", text: "", attachments: [] }, []).receivedAt).toMatch(/^\d{4}-/);
  });
  it("matches official mail by subject or preview, and not newsletters", () => {
    expect(looksOfficial("Wezwanie do uzupełnienia dokumentów", "")).toBe(true);
    expect(looksOfficial("Hello", "Your residence permit appointment")).toBe(true);
    expect(looksOfficial("50% off shoes", "Summer sale")).toBe(false);
  });
  it("lists only official, non-draft inbox messages newer than the baseline via a read-only Graph GET", async () => {
    let seen: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => { seen = JSON.parse(String(init?.body));
      return Response.json({ status: 200, data: { value: [{ id: "1", subject: "Wezwanie", bodyPreview: "" }, { id: "2", subject: "Sale", bodyPreview: "shoes" }, { id: "3", subject: "wezwanie", isDraft: true }] } }); }));
    const row = { account_id: "u1", category: "mail", provider: "outlook", broker_id: "ca_1", auth_config_id: "ac", label: "", scopes: "[]", connected_at: 1 } as AccountRow;
    const ids = await listOutlookIds({ COMPOSIO_API_KEY: "k", COMPOSIO_PROJECT_ID: "p" } as ConnectionsEnv, row, Date.parse("2026-11-01T00:00:00Z"));
    expect(ids).toEqual(["1"]);
    expect(seen.method).toBe("GET");
    expect(String(seen.endpoint)).toContain("/me/mailFolders/inbox/messages?");
    expect(String(seen.endpoint)).toContain("receivedDateTime%20ge%202026-11-01T00%3A00%3A00Z");
  });
});
