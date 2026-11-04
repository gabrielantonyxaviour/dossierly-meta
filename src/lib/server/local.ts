/** In-memory stand-ins so `next dev` and vitest work without wrangler. D1 runs on node:sqlite. */
import type { D1Like, D1Prepared, DONamespaceLike, Env, KVLike, R2Like } from "./env";
import { handleUserRequest, UserState } from "./userstate";

type Sqlite = { DatabaseSync: new (path: string) => SqliteDb };
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): { get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; run(...p: unknown[]): { changes: number | bigint } };
};

const clean = (v: unknown[]) => v.map((x) => (x === undefined ? null : x));

class LocalStmt implements D1Prepared {
  constructor(private db: SqliteDb, private sql: string, private params: unknown[] = []) {}
  bind(...values: unknown[]) {
    return new LocalStmt(this.db, this.sql, clean(values));
  }
  async first<T>() {
    const row = this.db.prepare(this.sql).get(...this.params);
    return row ? ({ ...(row as object) } as T) : null;
  }
  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.params).map((r) => ({ ...(r as object) }) as T) };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { meta: { changes: Number(r.changes) } };
  }
}

function localDb(): D1Like {
  const sqlite = process.getBuiltinModule?.("node:sqlite") as unknown as Sqlite | undefined;
  const fs = process.getBuiltinModule?.("node:fs");
  const path = process.getBuiltinModule?.("node:path");
  if (!sqlite || !fs || !path) throw new Error("Local D1 needs Node 22+ (node:sqlite)");
  const db = new sqlite.DatabaseSync(":memory:");
  const dir = path.join(process.cwd(), "migrations");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  // D1 serializes transactional batches; mirror that when concurrent requests share SQLite.
  let batches: Promise<unknown> = Promise.resolve();
  return {
    prepare: (sql) => new LocalStmt(db, sql),
    batch(stmts) {
      const result = batches.then(async () => {
        db.exec("BEGIN");
        try {
          const out = [];
          for (const s of stmts) out.push(await s.run());
          db.exec("COMMIT");
          return out;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      });
      batches = result.catch(() => undefined);
      return result;
    },
  };
}

function localKv(): KVLike {
  const m = new Map<string, { v: string; exp: number | null }>();
  return {
    async get(k) {
      const e = m.get(k);
      if (!e) return null;
      if (e.exp && e.exp < Date.now()) return m.delete(k), null;
      return e.v;
    },
    async put(k, v, o) {
      m.set(k, { v, exp: o?.expirationTtl ? Date.now() + o.expirationTtl * 1000 : null });
    },
    async delete(k) {
      m.delete(k);
    },
  };
}

function localR2(): R2Like {
  const m = new Map<string, Uint8Array>();
  return {
    async put(k, v) {
      m.set(k, typeof v === "string" ? new TextEncoder().encode(v) : new Uint8Array(v as ArrayBuffer));
    },
    async get(k) {
      const b = m.get(k);
      return b ? { arrayBuffer: async () => b.slice().buffer as ArrayBuffer } : null;
    },
    async delete(k) {
      m.delete(k);
    },
  };
}

function localDo(): DONamespaceLike {
  const states = new Map<string, UserState>();
  return {
    idFromName: (n) => n,
    get: (id) => ({
      async fetch(input, init) {
        const key = String(id);
        let s = states.get(key);
        if (!s) {
          const data = new Map<string, unknown>();
          s = new UserState({
            get: async <T>(k: string) => data.get(k) as T | undefined,
            put: async (k, v) => void data.set(k, v),
            setAlarm: async () => {},
          });
          states.set(key, s);
        }
        return handleUserRequest(s, new Request(input, init));
      },
    }),
  };
}

type Globals = typeof globalThis & { __settlaLocalEnv?: Env };

export function localEnv(): Env {
  const g = globalThis as Globals;
  if (g.__settlaLocalEnv) return g.__settlaLocalEnv;
  const e = process.env;
  g.__settlaLocalEnv = {
    DB: localDb(),
    CACHE: localKv(),
    BLOBS: localR2(),
    USER_DO: localDo(),
    MODEL_API_KEY: e.MODEL_API_KEY ?? "",
    BRIDGE_SECRET: e.BRIDGE_SECRET ?? "local-bridge-secret",
    SESSION_SECRET: e.SESSION_SECRET ?? "local-session-secret-not-for-production",
    RESEND_API_KEY: e.RESEND_API_KEY ?? "",
    EMAIL_FROM: e.EMAIL_FROM ?? "",
    COMPOSIO_API_KEY: e.COMPOSIO_API_KEY ?? "",
    COMPOSIO_PROJECT_ID: e.COMPOSIO_PROJECT_ID ?? "",
    COMPOSIO_GMAIL_AUTH_CONFIG_ID: e.COMPOSIO_GMAIL_AUTH_CONFIG_ID ?? "",
    COMPOSIO_OUTLOOK_AUTH_CONFIG_ID: e.COMPOSIO_OUTLOOK_AUTH_CONFIG_ID ?? "",
    COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID: e.COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID ?? "",
    COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID: e.COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID ?? "",
    COMPOSIO_GMAIL_DISABLED_REASON: e.COMPOSIO_GMAIL_DISABLED_REASON ?? "",
    COMPOSIO_GMAIL_TEST_USERS: e.COMPOSIO_GMAIL_TEST_USERS ?? "",
    DODO_PAYMENTS_API_KEY: e.DODO_PAYMENTS_API_KEY ?? "",
    DODO_WEBHOOK_KEY: e.DODO_WEBHOOK_KEY ?? "",
    JUDGE_CODE: e.JUDGE_CODE ?? "",
    DODO_ENV: /^live/.test(e.DODO_ENV ?? e.DODO_PAYMENTS_ENV ?? "") ? "live_mode" : "test_mode",
    DODO_PRODUCT_CASE_PASS: e.DODO_PRODUCT_CASE_PASS ?? "",
    DODO_PRODUCT_CREDITS_10: e.DODO_PRODUCT_CREDITS_10 ?? "",
    DODO_PRODUCT_CREDITS_25: e.DODO_PRODUCT_CREDITS_25 ?? "",
    DODO_PRODUCT_FAMILY: e.DODO_PRODUCT_FAMILY ?? "",
    APP_URL: e.APP_URL ?? "http://localhost:3000",
    APP_ENV: "local",
    MODELS_DISABLED: e.MODELS_DISABLED ?? "",
  };
  return g.__settlaLocalEnv;
}

/** Fresh isolated stubs for tests. */
export function freshLocalEnv(overrides: Partial<Env> = {}): Env {
  const g = globalThis as Globals;
  delete g.__settlaLocalEnv;
  const env = { ...localEnv(), ...overrides };
  delete g.__settlaLocalEnv;
  return env;
}
