-- Forwarding addresses come from a pool when INBOUND_POOL=on: each local part already has its own Email Routing rule
-- (literal match, sent to this worker), because the larinova.com zone's catch-all belongs to another product.
CREATE TABLE IF NOT EXISTS inbound_pool (
  local_part TEXT PRIMARY KEY,
  claimed_by TEXT,
  claimed_at INTEGER
);
CREATE INDEX IF NOT EXISTS inbound_pool_free ON inbound_pool (claimed_by);
