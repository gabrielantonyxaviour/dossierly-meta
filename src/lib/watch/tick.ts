import { readMessage } from "../onboarding/inbox";
import { readMail } from "../onboarding/extract";
import { rowFor } from "../server/connections/store";
import type { ConnectionsEnv } from "../server/connections/types";
import { accountEmail, callsEnabledFor } from "../voice/server/twilio";
import { writeDrafts } from "./drafts";
import { listNewMailIds } from "./list";
import { callAboutLetter, sendLetterEmail } from "./notify";
import { processMessage } from "./process";
import { dueAccounts, ensureAccount, lockAccount, raiseBaseline, releaseAccount, settledIds } from "./state";
import type { Deps, WatchItem, WatchReport } from "./types";

export const MAX_ACCOUNTS = 25;
export const MAX_MESSAGES_PER_ACCOUNT = 3;
const PARALLEL_ACCOUNTS = 5;

export const defaultDeps: Deps = {
  now: () => Date.now(),
  listIds: listNewMailIds,
  read: readMessage,
  readMail,
  draft: writeDrafts,
  hasCalendar: async (env, accountId) => !!(await rowFor(env, accountId, "calendar")),
  call: callAboutLetter,
  email: sendLetterEmail,
};

type Counts = { checked: number; found: number; processed: WatchItem[]; error?: string };

async function watchAccount(env: ConnectionsEnv, deps: Deps, accountId: string): Promise<Counts> {
  const out: Counts = { checked: 0, found: 0, processed: [] };
  const row = await rowFor(env, accountId, "mail");
  if (!row || row.provider !== "gmail") return out;
  // While setup runs (or a review run restarts it), the onboarding import owns the inbox: never write or call twice.
  const setup = await env.DB.prepare("SELECT completed_at FROM onboarding_progress WHERE account_id = ?").bind(accountId).first<{ completed_at: number | null }>();
  if (!setup?.completed_at) return out;
  const state = await ensureAccount(env, accountId, row.connected_at);
  // Reconnecting moves the baseline forward: what the onboarding import handled stays handled.
  if (row.connected_at > state.since) await raiseBaseline(env, accountId, row.connected_at);
  const since = Math.max(state.since, row.connected_at);
  const started = deps.now();
  if (!(await lockAccount(env, accountId, started))) return out;
  try {
    const ids = await deps.listIds(env, row, since);
    out.checked = ids.length;
    const settled = await settledIds(env, accountId, ids);
    const fresh = ids.filter((id) => !settled.has(id)).reverse().slice(0, MAX_MESSAGES_PER_ACCOUNT);
    const email = await accountEmail(env, accountId);
    const ctx = { accountId, userId: accountId, since, demo: callsEnabledFor(env, email), email };
    for (const id of fresh) {
      out.found += 1;
      const item = await processMessage(env, deps, ctx, id);
      if (item) out.processed.push(item);
    }
  } catch (e) {
    out.error = (e as { code?: string }).code ?? "internal";
  } finally {
    await releaseAccount(env, accountId, deps.now()).catch(() => undefined);
  }
  return out;
}

/** One pass of the watcher: for one account (QA) or the 25 least recently checked Gmail accounts. */
export async function runWatchTick(env: ConnectionsEnv, opts: { accountId?: string } = {}, deps: Deps = defaultDeps): Promise<WatchReport> {
  const ids = opts.accountId ? [opts.accountId] : (await dueAccounts(env, MAX_ACCOUNTS)).map((r) => r.account_id);
  const report: WatchReport = { accounts: ids.length, checked: 0, found: 0, processed: [], errors: [] };
  for (let i = 0; i < ids.length; i += PARALLEL_ACCOUNTS) {
    const batch = ids.slice(i, i + PARALLEL_ACCOUNTS);
    const results = await Promise.all(batch.map((id) => watchAccount(env, deps, id).catch((): Counts => ({ checked: 0, found: 0, processed: [], error: "internal" }))));
    results.forEach((r, j) => {
      report.checked += r.checked;
      report.found += r.found;
      report.processed.push(...r.processed);
      if (r.error) report.errors.push({ accountId: batch[j], code: r.error });
    });
  }
  return report;
}
