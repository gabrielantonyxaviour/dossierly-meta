import { describe, expect, it } from "vitest";
import { freshLocalEnv } from "@/lib/server/local";
import { emailAccount } from "@/lib/server/email-accounts";
import { gmailTestingAccess } from "@/lib/server/connections/testing";
import { connect } from "@/lib/server/connections/service";

describe("Google Testing client is never advertised as generally available", () => {
  it("allows only verified approved Google mailbox identities, including legitimately verified Gmail aliases", async () => {
    const env = freshLocalEnv({ COMPOSIO_AUTH_MODE: "custom", COMPOSIO_GMAIL_TEST_USERS: "gabrielantony56@gmail.com" } as never);
    const qa = await emailAccount(env, "gabrielantony56+dosreal.owned@gmail.com", null, Date.now());
    const other = await emailAccount(env, "ananya.rao@example.org", null, Date.now());
    expect(await gmailTestingAccess(env, qa)).toEqual({ restricted: true, allowed: true });
    expect(await gmailTestingAccess(env, other)).toEqual({ restricted: true, allowed: false });
    expect(await gmailTestingAccess(env, "u_unknown")).toEqual({ restricted: true, allowed: false });
    await expect(connect(env, other, new Request("https://dossierly.pages.dev"), { category: "mail", provider: "gmail" })).rejects.toMatchObject({ code: "connection_testing" });
  });
  it("fails closed for invalid testing configuration and accepts no merely supplied email parameter", async () => {
    const env = freshLocalEnv({ COMPOSIO_AUTH_MODE: "custom", COMPOSIO_GMAIL_TEST_USERS: "invalid" } as never);
    expect(await gmailTestingAccess(env, "gabrielantony56@gmail.com")).toEqual({ restricted: true, allowed: false });
  });
});
