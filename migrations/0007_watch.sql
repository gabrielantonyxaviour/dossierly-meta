-- 24/7 inbox watcher: per-account baseline + lock, and one row per Gmail message ever claimed (idempotency).
CREATE TABLE IF NOT EXISTS watch_accounts (
  account_id TEXT PRIMARY KEY,
  since INTEGER NOT NULL,
  lock_until INTEGER NOT NULL DEFAULT 0,
  last_run INTEGER
);
CREATE TABLE IF NOT EXISTS watch_messages (
  account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','done','skipped','failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  received_at INTEGER,
  claimed_at INTEGER NOT NULL,
  done_at INTEGER,
  called_at INTEGER,
  call_sid TEXT,
  letter_doc_id TEXT,
  error TEXT,
  PRIMARY KEY(account_id, message_id)
);
CREATE INDEX IF NOT EXISTS watch_messages_recent ON watch_messages(account_id, claimed_at);
