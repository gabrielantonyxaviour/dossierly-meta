import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import { authMode, MANAGED, requireConfigId, resetAuthConfigCache, resolveConfigId } from "@/lib/server/connections/authconfig";
import type { ConnectionsEnv } from "@/lib/server/connections/types";

let env: ConnectionsEnv; let calls: { method: string; url: string; body?: Record<string, unknown> }[]; let existing: unknown[];
beforeEach(() => {
  resetAuthConfigCache(); calls = []; existing = [];
  env = Object.assign(freshLocalEnv(), { COMPOSIO_API_KEY: "k", COMPOSIO_PROJECT_ID: "pr_1", COMPOSIO_GMAIL_AUTH_CONFIG_ID: "ac_custom_gmail" }) as ConnectionsEnv;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url), method = init?.method ?? "GET", body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url: u.pathname + u.search, body });
    if (method === "GET" && u.pathname.endsWith("/auth_configs")) return Response.json({ items: existing });
    if (method === "POST" && u.pathname.endsWith("/auth_configs")) { existing = [{ id: "ac_new", name: body.auth_config.name, status: "ENABLED", is_composio_managed: true, toolkit: { slug: body.toolkit.slug } }]; return Response.json({ auth_config: { id: "ac_new" } }); }
    const id = decodeURIComponent(u.pathname.split("/").pop()!);
    const found = (existing as { id: string }[]).find((c) => c.id === id);
    return found ? Response.json(found) : new Response("{}", { status: 404 });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("Composio auth mode", () => {
  it("defaults to managed; custom only when asked", () => {
    expect(authMode(env)).toBe("managed");
    expect(authMode({ ...env, COMPOSIO_AUTH_MODE: "custom" })).toBe("custom");
    expect(authMode({ ...env, COMPOSIO_AUTH_MODE: "nonsense" })).toBe("managed");
  });
  it("custom mode uses the configured ids and never calls the list or create endpoints", async () => {
    const c = { ...env, COMPOSIO_AUTH_MODE: "custom" };
    expect(await resolveConfigId(c, "gmail")).toBe("ac_custom_gmail");
    expect(await resolveConfigId(c, "outlook")).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
  it("managed mode reuses an existing managed config by name and ignores the custom id", async () => {
    existing = [{ id: "ac_managed", name: MANAGED.gmail.name, status: "ENABLED", is_composio_managed: true, toolkit: { slug: "gmail" } }];
    expect(await resolveConfigId(env, "gmail")).toBe("ac_managed");
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(await requireConfigId(env, "gmail")).toBe("ac_managed");
  });
  it("managed mode does not reuse our custom (non-managed) config of the same toolkit", async () => {
    existing = [{ id: "ac_custom", name: MANAGED.gmail.name, status: "ENABLED", is_composio_managed: false, toolkit: { slug: "gmail" } }];
    resetAuthConfigCache();
    const id = await resolveConfigId(env, "gmail");
    expect(id).toBe("ac_new");
  });
  it("managed mode creates a read-only managed config when none exists", async () => {
    expect(await resolveConfigId(env, "outlook")).toBe("ac_new");
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ toolkit: { slug: "outlook" }, auth_config: { type: "use_composio_managed_auth", name: "dossierly-outlook-read", credentials: { scopes: ["offline_access", "User.Read", "Mail.Read"] } } });
    expect(await resolveConfigId(env, "outlook")).toBe("ac_new");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
  });
  it("is unavailable without Composio credentials", async () => {
    expect(await resolveConfigId({ ...env, COMPOSIO_API_KEY: "" }, "gmail")).toBeUndefined();
    await expect(requireConfigId({ ...env, COMPOSIO_API_KEY: "" }, "gmail")).rejects.toMatchObject({ code: "connection_unavailable" });
  });
});
