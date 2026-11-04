import type { CaseSnapshot } from "../case/types";
import type { MessageBody } from "../onboarding/inbox";
import type { MailReading } from "../onboarding/findings";
import type { AccountRow, ConnectionsEnv } from "../server/connections/types";
import type { DraftOut } from "./drafts";
import type { LetterCallInput } from "./notify";

export type WatchItem = { messageId: string; subject: string; letterDocId: string | null; deadlineId: string | null; draftIds: string[]; called: boolean; emailed?: boolean; error?: string };
export type WatchReport = { accounts: number; checked: number; found: number; processed: WatchItem[]; errors: { accountId: string; code: string }[] };

/** Everything outside D1 and the case store, injectable so ticks are testable without Gmail, Spark or Twilio. */
export type Deps = {
  now: () => number;
  listIds: (env: ConnectionsEnv, row: AccountRow, since: number) => Promise<string[]>;
  read: (env: ConnectionsEnv, accountId: string, messageId: string) => Promise<MessageBody>;
  readMail: (env: ConnectionsEnv, userId: string, msg: MessageBody, ctx: { fullName: string | null; language: string }) => Promise<MailReading>;
  draft: (env: ConnectionsEnv, userId: string, msg: MessageBody, snap: CaseSnapshot, asks: string) => Promise<DraftOut>;
  hasCalendar: (env: ConnectionsEnv, accountId: string) => Promise<boolean>;
  call: (env: ConnectionsEnv, a: { accountId: string; userId: string; letter: LetterCallInput }) => Promise<{ callSid: string; to: string }>;
  email: (env: ConnectionsEnv, to: string, a: { title: string; dueDate: string | null }) => Promise<boolean>;
};
