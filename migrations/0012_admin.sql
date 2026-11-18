-- Admin: email whitelist, promo codes, whitelist discounts, audit log. Purchases may now be 0 zł (100% promo).

CREATE TABLE email_whitelist (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  grant_kind TEXT NOT NULL CHECK (grant_kind IN ('one_case','household_year','discount_percent')),
  grant_value INTEGER,
  grant_expires_at INTEGER,
  entry_expires_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by_account TEXT
);

CREATE TABLE promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
  plans TEXT NOT NULL,
  max_uses INTEGER,
  per_customer INTEGER NOT NULL DEFAULT 1,
  starts_at INTEGER,
  expires_at INTEGER,
  note TEXT NOT NULL DEFAULT '',
  dodo_discount_id TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER
);

-- A whitelisted percent discount, waiting for the account's next checkout.
CREATE TABLE account_discounts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_id TEXT NOT NULL UNIQUE,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 99),
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  applied_purchase_id TEXT
);
CREATE INDEX account_discounts_account ON account_discounts (account_id);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log (at);

ALTER TABLE entitlements ADD COLUMN source TEXT NOT NULL DEFAULT 'purchase';

-- Rebuild purchases: amount_grosz may be 0 (100% promo) and a purchase can carry a promo or a whitelist discount.
CREATE TABLE purchases_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('one_case','household_year')),
  base_grosz INTEGER NOT NULL CHECK (base_grosz > 0),
  amount_grosz INTEGER NOT NULL CHECK (amount_grosz >= 0),
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
  refunded_at INTEGER,
  promo_id TEXT,
  promo_discount_grosz INTEGER NOT NULL DEFAULT 0,
  account_discount_id TEXT
);
INSERT INTO purchases_new (id, user_id, plan, base_grosz, amount_grosz, referral_discount_grosz, credit_grosz, founding, referral_code, status, reserved_until, dodo_session_id, dodo_payment_id, dodo_discount_code, created_at, paid_at, refunded_at)
  SELECT id, user_id, plan, base_grosz, amount_grosz, referral_discount_grosz, credit_grosz, founding, referral_code, status, reserved_until, dodo_session_id, dodo_payment_id, dodo_discount_code, created_at, paid_at, refunded_at FROM purchases;
DROP TABLE purchases;
ALTER TABLE purchases_new RENAME TO purchases;
CREATE INDEX purchases_user ON purchases (user_id, created_at);
CREATE UNIQUE INDEX purchases_founding_once ON purchases (user_id) WHERE founding = 1 AND status IN ('pending','succeeded');
CREATE INDEX purchases_promo ON purchases (promo_id) WHERE promo_id IS NOT NULL;
