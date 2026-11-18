/**
 * Fills the forwarding-address pool: creates N local parts, one Email Routing rule each on the larinova.com zone
 * (literal "to" match, action: this worker), then inserts them into inbound_pool in the larinova D1.
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/inbound-pool.mjs <count>   (prints counts only, never the token)
 * Rules are never deleted on rotation: a retired address still reaches this worker, which rejects it.
 */
import { execFileSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ZONE = "bbaaf33c5998f5ebb76ea82164662d98"; // larinova.com
const DOMAIN = "in.larinova.com";
const WORKER = "dossierly-larinova";
const count = Number(process.argv[2] ?? 0);
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token || !(count > 0 && count <= 150)) throw new Error("Set CLOUDFLARE_API_TOKEN and a count between 1 and 150");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function local() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  let s = ""; for (const x of b) { if (x < 248 && s.length < 10) s += ALPHABET[x % 31]; }
  return s.length === 10 ? `case-${s}` : local();
}

const made = [];
for (let i = 0; i < count; i++) {
  const lp = local();
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}/email/routing/rules`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: `dossierly ${lp}`, enabled: true, matchers: [{ type: "literal", field: "to", value: `${lp}@${DOMAIN}` }], actions: [{ type: "worker", value: [WORKER] }] }),
  });
  const body = await res.json();
  if (!body.success) { process.stdout.write(`rule failed after ${made.length}: ${JSON.stringify(body.errors)}\n`); break; }
  made.push(lp);
}
if (made.length) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pool-")), "pool.sql");
  fs.writeFileSync(file, made.map((l) => `INSERT OR IGNORE INTO inbound_pool (local_part) VALUES ('${l}');`).join("\n"));
  execFileSync("npx", ["wrangler", "d1", "execute", "DB", "--config", "wrangler.jsonc", "--env", "larinova", "--remote", "--file", file], { stdio: "ignore" });
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
}
process.stdout.write(`pool: ${made.length} addresses routed to ${WORKER} and stored\n`);
