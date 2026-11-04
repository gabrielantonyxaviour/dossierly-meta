import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import * as environment from "@/lib/server/env";
import { callback, connect, disconnect, status } from "@/lib/server/connections/service";
import { saveRow } from "@/lib/server/connections/store";
import { verifyRemote } from "@/lib/server/connections/broker";
import { createEvent } from "@/lib/server/connections/calendar";
import { importMail, plainText } from "@/lib/server/connections/mail";
import { handler } from "@/lib/server/connections/handlers";
import { createAccountUser, sessionCookie } from "@/lib/server/session";
import type { AccountRow, ConnectionsEnv } from "@/lib/server/connections/types";

let env: ConnectionsEnv;
let remoteOwner = "dossierly:u1", remoteStatus = "ACTIVE", callbackUrl = "", proxyCalls: { method: string; endpoint: string; body?: unknown }[] = [];
const request = (url = "https://dossierly.pages.dev/api/connections", body?: unknown, origin = "https://dossierly.pages.dev") => new Request(url, {
  method: body ? "POST" : "GET", headers: { cookie: "settla_uid=owned", origin, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const row = (category: "mail" | "calendar" = "mail", provider: AccountRow["provider"] = "gmail"): AccountRow => ({ account_id: "u1", category, provider, broker_id: "ca_owned", auth_config_id: provider === "googlecalendar" ? "ac_cal" : "ac_mail", label: "Owned QA", scopes: "[]", connected_at: 1 });
let failWrite = false;
beforeEach(() => {
  env = Object.assign(freshLocalEnv(), { COMPOSIO_API_KEY: "test-key", COMPOSIO_PROJECT_ID: "pr_owned", COMPOSIO_GMAIL_AUTH_CONFIG_ID: "ac_mail", COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID: "ac_cal", APP_URL: "https://dossierly.pages.dev" });
  remoteOwner = "dossierly:u1"; remoteStatus = "ACTIVE"; callbackUrl = ""; proxyCalls = []; failWrite = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path.includes("auth_configs/")) return Response.json({ id: "ac_mail", name: "dossierly-gmail-read", toolkit: { slug: "gmail" } });
    if (path.endsWith("connected_accounts/link")) { callbackUrl = body.callback_url; return Response.json({ connected_account_id: "ca_owned", redirect_url: "https://connect.composio.dev/link/owned" }); }
    if (path.includes("connected_accounts/")) return Response.json({ id: "ca_owned", user_id: remoteOwner, status: remoteStatus, toolkit: { slug: "gmail" }, auth_config: { id: "ac_mail" }, state: { val: { scope: "https://www.googleapis.com/auth/gmail.readonly" } } });
    if (path.endsWith("tools/execute/proxy")) {
      proxyCalls.push(body);
      if (body.endpoint.includes("/profile")) return Response.json({ status: 200, data: { emailAddress: "owned@example.org" } });
      if (body.endpoint.includes("calendarList")) return Response.json({ status: 200, data: { items: [{ id: "primary", summary: "Owned", accessRole: "owner" }] } });
      if (body.method === "POST" && failWrite) throw new Error("ambiguous network timeout");
      if (body.method === "POST") return Response.json({ status: 200, data: { id: "event_owned", htmlLink: "https://calendar.google.com/event/owned" } });
      return Response.json({ status: 200, data: { id: "mail1", payload: { headers: [], parts: [{ mimeType: "application/pdf", filename: "letter.pdf", body: { attachmentId: "att1", size: 4_000_001 } }] } } });
    }
    throw new Error("Unexpected endpoint");
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("owned provider connections", () => {
  it("uses Workers-supported manual redirect handling and never follows a credential-bearing redirect", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://other.example" } }));
    await expect(connect(env, "u1", request(), { category: "mail", provider: "gmail" })).rejects.toMatchObject({ code: "provider_unavailable" });
    expect(vi.mocked(fetch).mock.calls[0][1]?.redirect).toBe("manual");
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
  });
  it("reports unavailable without provider configuration and never fabricates connected state", async () => {
    env.COMPOSIO_API_KEY = "";
    const r = await status(env, "u1"); expect(r.connections).toEqual({ mail: null, calendar: null }); expect(r.capabilities.every(c => !c.available)).toBe(true);
    await expect(connect(env, "u1", request(), { category: "mail", provider: "gmail" })).rejects.toMatchObject({ code: "connection_unavailable" });
  });
  it("keeps a known disabled provider unavailable even when its configuration exists", async () => {
    env.COMPOSIO_GMAIL_DISABLED_REASON = "managed-client-blocked";
    expect((await status(env, "u1")).capabilities.find(c => c.provider === "gmail")).toMatchObject({ available: false });
    await expect(connect(env, "u1", request(), { category: "mail", provider: "gmail" })).rejects.toMatchObject({ code: "connection_unavailable" });
  });
  it("uses a session-bound one-use state and verifies remote user before replacing a category", async () => {
    await connect(env, "u1", request(), { category: "mail", provider: "gmail" });
    await expect(callback(env, "u2", request(callbackUrl))).rejects.toMatchObject({ code: "invalid_connection_state" });
    await expect(callback(env, "u1", new Request(callbackUrl, { headers: { cookie: "settla_uid=other" } }))).rejects.toMatchObject({ code: "invalid_connection_state" });
    expect(await callback(env, "u1", request(callbackUrl))).toBe("/onboarding");
    expect((await status(env, "u1")).connections.mail).toMatchObject({ status: "connected", label: "owned@example.org" });
    await expect(callback(env, "u1", request(callbackUrl))).rejects.toMatchObject({ code: "invalid_connection_state" });
  });
  it("preserves an old working connection after failed consent, expiry or foreign-user callback", async () => {
    await saveRow(env, { ...row(), broker_id: "ca_old" });
    await connect(env, "u1", request(), { category: "mail", provider: "gmail" }); remoteOwner = "dossierly:other";
    await expect(callback(env, "u1", request(callbackUrl))).rejects.toMatchObject({ code: "connection_reconnect" });
    expect(await env.DB.prepare("SELECT broker_id FROM connection_accounts WHERE account_id='u1'").first()).toEqual({ broker_id: "ca_old" });
    await connect(env, "u1", request(), { category: "mail", provider: "gmail" });
    await env.DB.prepare("UPDATE connection_intents SET expires_at=1").run();
    await expect(callback(env, "u1", request(callbackUrl))).rejects.toMatchObject({ code: "invalid_connection_state" });
  });
  it("refuses foreign, revoked and mismatched provider accounts", async () => {
    remoteOwner = "dossierly:other"; await expect(verifyRemote(env, row())).rejects.toMatchObject({ code: "connection_reconnect" });
    remoteOwner = "dossierly:u1"; remoteStatus = "EXPIRED"; await expect(verifyRemote(env, row())).rejects.toMatchObject({ code: "connection_reconnect" });
    remoteStatus = "ACTIVE"; await expect(verifyRemote(env, { ...row(), auth_config_id: "ac_other" })).rejects.toMatchObject({ code: "connection_reconnect" });
  });
  it("disconnects one reference without deleting a connection used by another category", async () => {
    await saveRow(env, row()); await saveRow(env, { ...row("calendar"), provider: "microsoftcalendar" });
    expect(await disconnect(env, "u1", "mail")).toMatchObject({ ok: true, providerRevocationRequired: false });
    expect(vi.mocked(fetch).mock.calls.some(([, i]) => i?.method === "DELETE")).toBe(false);
    expect(await env.DB.prepare("SELECT category FROM connection_accounts WHERE account_id='u1'").first()).toEqual({ category: "calendar" });
  });
  it("does not access an attachment when account ownership fails or declared bytes exceed limit", async () => {
    await saveRow(env, row()); remoteOwner = "dossierly:other";
    await expect(importMail(env, "u1", { messageId: "mail1", attachmentId: "att1" })).rejects.toMatchObject({ code: "connection_reconnect" }); expect(proxyCalls).toHaveLength(0);
    remoteOwner = "dossierly:u1";
    await expect(importMail(env, "u1", { messageId: "mail1", attachmentId: "att1" })).rejects.toMatchObject({ code: "attachment_too_large" }); expect(proxyCalls).toHaveLength(1);
  });
  it("fetches a Gmail attachment by an id from an earlier read (Gmail re-issues ids on every read)", async () => {
    await saveRow(env, row());
    const pdf = btoa("%PDF-1.7 lease"); const base = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (!String(url).endsWith("tools/execute/proxy")) return base(url as string, init);
      proxyCalls.push(body);
      if (body.endpoint.includes("/attachments/att_old")) return Response.json({ status: 200, data: { data: pdf, size: 14 } });
      return Response.json({ status: 200, data: { id: "mail1", payload: { headers: [], parts: [
        { mimeType: "text/plain", body: { data: btoa("Lease attached") } },
        { mimeType: "application/pdf", filename: "umowa-najmu.pdf", body: { attachmentId: "att_new", size: 14 } },
        { mimeType: "image/png", filename: "logo.png", body: { attachmentId: "att_logo", size: 900 } },
      ] } } });
    });
    const got = await importMail(env, "u1", { messageId: "mail1", attachmentId: "att_old" });
    expect(got).toMatchObject({ kind: "attachment", file: { name: "umowa-najmu.pdf", mime: "application/pdf" } });
  });
  it("returns plain text with scripts and active markup removed", () => { expect(plainText('<script>steal()</script><b>Insurance</b><img src=x onerror=steal()>')).toBe(' Insurance  '); });
  it("rejects provider mismatch, external return paths and mutation without a same-origin request", async () => {
    await expect(connect(env, "u1", request(), { category: "calendar", provider: "gmail" })).rejects.toBeDefined();
    await expect(connect(env, "u1", request(), { category: "mail", provider: "gmail", returnPath: "//evil.example" })).rejects.toBeDefined();
    await createAccountUser(env, "u_route", "device"); const cookie = (await sessionCookie("u_route", env)).split(";")[0];
    vi.spyOn(environment, "getEnv").mockReturnValue(env);
    const r = await handler("connect")(new Request("http://localhost:3000/api/connections/connect", { method: "POST", headers: { cookie, origin: "https://evil.example", "content-type": "application/json" }, body: '{}' }));
    expect(r.status).toBe(403); expect(await r.json()).toMatchObject({ code: "invalid_origin" });
  });
  it("reserves an event once and refuses uncertain retries and altered idempotency payloads", async () => {
    // Use a matching calendar remote without weakening the ownership checks.
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (...args) => {
      if (String(args[0]).includes("connected_accounts/")) return Response.json({ id: "ca_owned", user_id: remoteOwner, status: remoteStatus, toolkit: { slug: "googlecalendar" }, auth_config: { id: "ac_cal" } });
      return original(...args);
    });
    await saveRow(env, row("calendar", "googlecalendar"));
    const input = { calendarId: "primary", title: "Dossierly owned test", date: "2026-11-20", idempotencyKey: "62cd8fe4-91b7-42cd-a742-8e26a1a8407d" };
    const a = await createEvent(env, "u1", input); const b = await createEvent(env, "u1", input);
    expect(a.replayed).toBe(false); expect(b.replayed).toBe(true); expect(proxyCalls.filter(c => c.method === "POST")).toHaveLength(1);
    expect(b.event.title).toBe(input.title);
    const stored = await env.DB.prepare("SELECT result FROM connection_event_receipts WHERE account_id='u1'").first<{ result: string }>();
    expect(stored?.result).not.toContain(input.title); expect(stored?.result).not.toContain("title");
    // The same key with new details updates the event this app created, in place (a re-read email), never a second event.
    const changed = await createEvent(env, "u1", { ...input, title: "Changed" });
    expect(changed.replayed).toBe(true); expect(changed.event.title).toBe("Changed");
    expect(proxyCalls.filter(c => c.method === "POST")).toHaveLength(1); expect(proxyCalls.filter(c => c.method === "PATCH")).toHaveLength(1);
    failWrite = true; const next = { ...input, idempotencyKey: "e52c6b94-cfd5-4393-9c94-0a083c202bdc" };
    await expect(createEvent(env, "u1", next)).rejects.toMatchObject({ code: "calendar_write_uncertain" });
    const calls = proxyCalls.length; await expect(createEvent(env, "u1", next)).rejects.toMatchObject({ code: "calendar_write_uncertain" }); expect(proxyCalls).toHaveLength(calls);
  });
});
