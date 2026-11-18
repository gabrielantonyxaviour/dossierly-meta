-- Billing: purchases, entitlements, household members, referrals, credit ledger, webhook log. Additive only.
-- All money is stored in grosz (1 zł = 100 grosz), VAT included.

CREATE TABLE purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('one_case','household_year')),
  base_grosz INTEGER NOT NULL CHECK (base_grosz > 0),
  amount_grosz INTEGER NOT NULL CHECK (amount_grosz > 0),
  referral_discount_grosz INTEGER NOT NULL DEFAULT 0,
  credit_grosz INTEGER NOT NULL DEFAULT 0,
  founding INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','refunded','expired','failed')),
  reserved_until INTEGER NOT NULL,
  dodo_session_id TEXT,
  dodo_payment_id TEXT UNIQUE,
  dodo_discount_code TEXT,
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  refunded_at INTEGER
);
CREATE INDEX purchases_user ON purchases (user_id, created_at);
-- One founding purchase per person, counted while pending or paid.
CREATE UNIQUE INDEX purchases_founding_once ON purchases (user_id) WHERE founding = 1 AND status IN ('pending','succeeded');

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('one_case','household_year')),
  people_limit INTEGER NOT NULL,
  starts_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX entitlements_user ON entitlements (user_id, expires_at);

-- The account holder is person 1 and is not stored here; at most 3 family members per holder.
CREATE TABLE household_members (
  id TEXT PRIMARY KEY,
  holder_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX household_members_holder ON household_members (holder_id);

CREATE TABLE referral_codes (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- One row per referred purchase; the referrer's reward is granted only once that purchase succeeds.
CREATE TABLE referral_events (
  purchase_id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL,
  referee_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','granted','revoked'))
);
CREATE INDEX referral_events_referee ON referral_events (referee_id);

CREATE TABLE credit_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta_grosz INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('referral_reward','spend','restore','clawback')),
  purchase_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, reason, purchase_id)
);
CREATE INDEX credit_ledger_user ON credit_ledger (user_id);

-- Idempotency: one row per Dodo webhook-id.
CREATE TABLE webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  outcome TEXT
);
