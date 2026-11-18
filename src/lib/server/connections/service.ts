import { z } from "zod";
import { ApiError } from "../http";
import { sha256Hex, randomId } from "../util";
import { broker, proxy, verifyConfig, verifyRemote, unavailable } from "./broker";
import { budget, publicRow, rowFor, saveRow } from "./store";
import { brokerUser, connectSchema, toolkit, type AccountRow, type Category, type ConnectionsEnv, type IntentRow, type Provider } from "./types";
import { retirePrevious } from "./retire";
import { gmailTestingAccess } from "./testing";
import { authMode, requireConfigId, resolveConfigId } from "./authconfig";

const sessionHash = (req: Request) => sha256Hex((req.headers.get("cookie") ?? "").split(/;\s*/).find(x => x.startsWith("settla_uid=")) ?? "");
export async function capabilities(env: ConnectionsEnv, accountId: string) {
  // The Google Testing-client restriction only applies to our own OAuth app; Composio's managed app has no test-user list.
  const testing = authMode(env) === "custom" ? await gmailTestingAccess(env, accountId) : { restricted: false, allowed: true };
  const providers: Provider[] = ["gmail", "outlook", "googlecalendar", "microsoftcalendar"];
  return Promise.all(providers.map(async provider => {
    const id = await resolveConfigId(env, provider).catch(() => undefined);
    const unapprovedTester = provider === "gmail" && testing.restricted && !testing.allowed;
    const blocked = provider === "gmail" && (Boolean(env.COMPOSIO_GMAIL_DISABLED_REASON) || unapprovedTester);
    let available = Boolean(env.COMPOSIO_API_KEY && env.COMPOSIO_PROJECT_ID && id && !blocked);
    if (available) { try { await verifyConfig(env, id!, provider); } catch { available = false; } }
    return { provider, category: ["gmail", "outlook"].includes(provider) ? "mail" : "calendar", available,
      ...(available && provider === "gmail" && testing.restricted ? { notice: "Gmail is available to approved test accounts while Google verification is pending." } : {}),
      ...(!available ? { reason: unapprovedTester ? "Gmail access is limited to approved test accounts during Google verification." : blocked ? "Gmail sign-in is unavailable from the connection provider. Try later." : "Provider authorization is not available. Try again later." } : {}) };
  }));
}
export async function status(env: ConnectionsEnv, accountId: string) {
  const cleanupPending = await retirePrevious(env, accountId);
  const connections: Record<Category, ReturnType<typeof publicRow> | null> = { mail: null, calendar: null };
  for (const category of ["mail", "calendar"] as const) {
    const row = await rowFor(env, accountId, category); if (!row) continue;
    try { await verifyRemote(env, row); connections[category] = publicRow(row, "connected"); }
    catch { connections[category] = publicRow(row, "reconnect"); }
  }
  return { capabilities: await capabilities(env, accountId), connections, cleanupPending, ...(cleanupPending ? { cleanupNotice: "Your previous connection is still being disconnected. Refresh connection status to retry." } : {}) };
}
export async function connect(env: ConnectionsEnv, accountId: string, req: Request, input: unknown) {
  const data = connectSchema.parse(input);
  if (data.provider === "gmail" && authMode(env) === "custom" && !(await gmailTestingAccess(env, accountId)).allowed) throw new ApiError(503, "Gmail access is limited to approved test accounts during Google verification.", "connection_testing");
  if (data.provider === "gmail" && env.COMPOSIO_GMAIL_DISABLED_REASON) throw new ApiError(503, "Gmail sign-in is unavailable from the connection provider. Try later.", "connection_unavailable");
  const authId = await requireConfigId(env, data.provider);
  await budget(env, accountId);
  const state = randomId("oauth", 32), stateHash = await sha256Hex(state);
  const callbackUrl = new URL("/api/connections/callback", env.APP_URL);
  callbackUrl.searchParams.set("state", state);
  const link = z.object({ connected_account_id: z.string().regex(/^ca_[\w-]+$/), redirect_url: z.url() }).parse(await broker(env, "connected_accounts/link", {
    user_id: brokerUser(accountId), auth_config_id: authId, callback_url: callbackUrl.toString(),
  }));
  const url = new URL(link.redirect_url);
  if (url.protocol !== "https:" || !(url.hostname === "composio.dev" || url.hostname.endsWith(".composio.dev"))) throw unavailable();
  await env.DB.prepare("DELETE FROM connection_intents WHERE expires_at <= ?").bind(Date.now()).run();
  await env.DB.prepare("INSERT INTO connection_intents (state_hash, account_id, session_hash, category, provider, auth_config_id, broker_id, return_path, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(stateHash, accountId, await sessionHash(req), data.category, data.provider, authId, link.connected_account_id, data.returnPath, Date.now() + 600_000).run();
  return { redirectUrl: url.toString() };
}
export async function callback(env: ConnectionsEnv, accountId: string, req: Request) {
  const state = z.string().regex(/^oauth_[\w-]{43}$/).parse(new URL(req.url).searchParams.get("state"));
  const hash = await sha256Hex(state), now = Date.now();
  const intent = await env.DB.prepare("SELECT * FROM connection_intents WHERE state_hash = ? AND account_id = ? AND session_hash = ? AND consumed_at IS NULL AND expires_at > ?")
    .bind(hash, accountId, await sessionHash(req), now).first<IntentRow>();
  if (!intent) throw new ApiError(400, "This connection link has expired. Start again.", "invalid_connection_state");
  const consumed = await env.DB.prepare("UPDATE connection_intents SET consumed_at = ? WHERE state_hash = ? AND consumed_at IS NULL AND expires_at > ?").bind(now, hash, now).run();
  if (consumed.meta?.changes !== 1) throw new ApiError(400, "This connection link has expired. Start again.", "invalid_connection_state");
  const row: AccountRow = { ...intent, label: "", scopes: "[]", connected_at: now };
  const remote = await verifyRemote(env, row);
  const scope = remote.state?.val?.scope ?? remote.state?.val?.scopes;
  const scopes = Array.isArray(scope) ? scope.filter((v): v is string => typeof v === "string") : typeof scope === "string" ? scope.split(/[ ,]+/).filter(Boolean) : [];
  // A provider profile request establishes the actual authorized identity, not a callback success flag.
  const profile = toolkit(row.provider) === "gmail" ? z.object({ emailAddress: z.string() }).parse(await proxy(env, row, "https://gmail.googleapis.com/gmail/v1/users/me/profile"))
    : toolkit(row.provider) === "outlook" ? z.object({ mail: z.string().nullable().optional(), userPrincipalName: z.string().optional() }).parse(await proxy(env, row, "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"))
    : z.object({ id: z.string() }).parse(await proxy(env, row, "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary?fields=id"));
  row.label = ("emailAddress" in profile ? profile.emailAddress : "id" in profile ? profile.id : profile.mail || profile.userPrincipalName || "Microsoft account").slice(0, 254);
  row.scopes = JSON.stringify(scopes); await saveRow(env, row);
  await retirePrevious(env, accountId);
  return intent.return_path;
}
export async function disconnect(env: ConnectionsEnv, accountId: string, category: Category) {
  const row = await rowFor(env, accountId, category); if (!row) return { ok: true };
  // Do not delete a remote row until its ownership has been established, even if it is revoked.
  const remote = z.object({ id: z.string(), user_id: z.string(), toolkit: z.object({ slug: z.string() }), auth_config: z.object({ id: z.string() }) })
    .parse(await broker(env, `connected_accounts/${encodeURIComponent(row.broker_id)}`));
  if (remote.id !== row.broker_id || remote.user_id !== brokerUser(accountId) || remote.toolkit.slug !== toolkit(row.provider) || remote.auth_config.id !== row.auth_config_id) throw new ApiError(409, "This connection cannot be changed.", "connection_reconnect");
  const other = await rowFor(env, accountId, category === "mail" ? "calendar" : "mail");
  if (other?.broker_id !== row.broker_id) await broker(env, `connected_accounts/${encodeURIComponent(row.broker_id)}`, undefined, "DELETE");
  await env.DB.prepare("DELETE FROM connection_accounts WHERE account_id = ? AND category = ? AND broker_id = ?").bind(accountId, category, row.broker_id).run();
  return { ok: true, providerRevocationRequired: other?.broker_id !== row.broker_id };
}
