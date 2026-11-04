import { z } from "zod";
import { proxy } from "../server/connections/broker";
import type { AccountRow } from "../server/connections/types";
import type { ConnectionsEnv } from "../server/connections/types";
import { OFFICIAL_QUERY } from "../onboarding/inbox";

export const MAX_LIST = 10;

export const watchQuery = (since: number) => `after:${Math.floor(since / 1000)} -in:chats -category:promotions -category:social (${OFFICIAL_QUERY})`;

/**
 * Ids of official-looking mail that arrived after the baseline, newest first. Read-only: one Gmail search.
 * Deliberately not metered against the per-day connection budget the user's own actions share.
 */
export async function listNewMailIds(env: ConnectionsEnv, row: AccountRow, since: number): Promise<string[]> {
  const q = new URLSearchParams({ maxResults: String(MAX_LIST), q: watchQuery(since) });
  const page = z.object({ messages: z.array(z.object({ id: z.string() })).optional() })
    .parse(await proxy(env, row, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`));
  return (page.messages ?? []).slice(0, MAX_LIST).map((m) => m.id);
}
