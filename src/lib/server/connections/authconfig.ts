import { z } from "zod";
import { broker, unavailable, verifyConfig } from "./broker";
import { configId, toolkit, type ConnectionsEnv, type Provider } from "./types";

/**
 * Which Composio auth config a provider connects through.
 *   managed (default): Composio's own verified Google/Microsoft OAuth app, so any account can connect.
 *   custom: our own OAuth app, whose auth config ids come from COMPOSIO_*_AUTH_CONFIG_ID.
 * Docs: https://docs.composio.dev/docs/authentication/programmatic-auth-configs (POST /api/v3.1/auth_configs,
 * auth_config.type "use_composio_managed_auth"; credentials.scopes narrows the managed app's default scopes).
 */
export const authMode = (env: ConnectionsEnv): "managed" | "custom" => env.COMPOSIO_AUTH_MODE === "custom" ? "custom" : "managed";

/** Name and read-only scopes of the managed config for each provider. Names must start with "dossierly-" (verifyConfig). */
export const MANAGED: Record<Provider, { name: string; scopes: string[] }> = {
  gmail: { name: "dossierly-gmail-read", scopes: ["https://www.googleapis.com/auth/gmail.readonly"] },
  outlook: { name: "dossierly-outlook-read", scopes: ["offline_access", "User.Read", "Mail.Read"] },
  googlecalendar: { name: "dossierly-googlecalendar-reviewed", scopes: ["https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events"] },
  microsoftcalendar: { name: "dossierly-microsoftcalendar-reviewed", scopes: ["offline_access", "User.Read", "Calendars.ReadWrite"] },
};

const listSchema = z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), status: z.string().optional(), is_composio_managed: z.boolean().optional(), toolkit: z.object({ slug: z.string() }) })) });
const createSchema = z.object({ auth_config: z.object({ id: z.string() }) });
const cache = new Map<string, string>();
/** Test hook: the lookup result is cached per isolate. */
export const resetAuthConfigCache = () => cache.clear();

async function managedId(env: ConnectionsEnv, provider: Provider): Promise<string> {
  const want = MANAGED[provider], slug = toolkit(provider), key = `${env.COMPOSIO_PROJECT_ID}:${want.name}`;
  const hit = cache.get(key); if (hit) return hit;
  const list = listSchema.parse(await broker(env, `auth_configs?search=${encodeURIComponent(want.name)}&toolkit_slug=${slug}&limit=50`));
  const found = list.items.find(c => c.name === want.name && c.toolkit.slug === slug && c.is_composio_managed === true && c.status !== "DISABLED");
  let id = found?.id;
  if (!id) {
    id = createSchema.parse(await broker(env, "auth_configs", { toolkit: { slug }, auth_config: { type: "use_composio_managed_auth", name: want.name, credentials: { scopes: want.scopes } } })).auth_config.id;
  }
  cache.set(key, id); return id;
}

/** The auth config id to connect through, or undefined when custom mode has none configured. */
export async function resolveConfigId(env: ConnectionsEnv, provider: Provider): Promise<string | undefined> {
  if (!env.COMPOSIO_API_KEY || !env.COMPOSIO_PROJECT_ID) return undefined;
  if (authMode(env) === "custom") return configId(env, provider) || undefined;
  return managedId(env, provider);
}
export async function requireConfigId(env: ConnectionsEnv, provider: Provider): Promise<string> {
  const id = await resolveConfigId(env, provider).catch(() => undefined);
  if (!id) throw unavailable();
  await verifyConfig(env, id, provider); return id;
}
