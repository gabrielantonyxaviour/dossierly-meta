-- Personal access tokens for the Dossierly MCP server. Only the SHA-256 hash of a token is stored.
CREATE TABLE IF NOT EXISTS mcp_tokens (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  case_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('read','act')),
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS mcp_tokens_account ON mcp_tokens(account_id, created_at);
