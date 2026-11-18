-- Per-user forwarding address: the local part of case-<random>@<INBOUND_MAIL_DOMAIN>. One live address per account.
CREATE TABLE IF NOT EXISTS inbound_addresses (
  account_id TEXT PRIMARY KEY,
  local_part TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  rotated_at INTEGER,
  -- A forwarding-confirmation mail from the user's own provider (Gmail sends a code and a link) is kept here, not read as a letter.
  confirm_code TEXT,
  confirm_link TEXT,
  confirm_at INTEGER
);
-- Retired local parts are kept so a rotated address is never handed out again.
CREATE TABLE IF NOT EXISTS inbound_retired (
  local_part TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  retired_at INTEGER NOT NULL
);
