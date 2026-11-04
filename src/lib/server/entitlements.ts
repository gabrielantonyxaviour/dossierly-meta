import type { Env } from "./env";

/** Everything is free. Records one letter read for the account and always allows it. */
export async function spendLetter(env: Env, accountId: string, _planKind?: string): Promise<boolean> {
  await env.DB.prepare("UPDATE users SET letters_used = letters_used + 1 WHERE id = ?").bind(accountId).run();
  return true;
}
