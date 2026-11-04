import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type D1 = { binding: string; database_name: string; database_id: string };
type Conf = {
  name: string;
  routes?: { pattern: string; custom_domain?: boolean }[];
  services?: { binding: string; service: string }[];
  d1_databases?: D1[];
  kv_namespaces?: { binding: string; id: string }[];
  r2_buckets?: { binding: string; bucket_name: string }[];
  durable_objects?: { bindings: { name: string; class_name: string }[] };
  vars?: Record<string, string>;
  env?: Record<string, Conf>;
};

const conf = JSON.parse(readFileSync("wrangler.jsonc", "utf8")) as Conf;
const previews = ["onboarding", "app", "voice", "look"] as const;

describe("dossierly-meta Cloudflare environments", () => {
  it("never targets the Nebius-hackathon production Worker or its resources", () => {
    const all = [conf, ...previews.map((p) => conf.env![p])];
    const text = JSON.stringify(conf);
    expect(text).not.toContain("settla-app");
    expect(text).not.toContain("settla-db");
    expect(text).not.toContain("settla-blobs");
    for (const c of all) expect(c.name.startsWith("dossierly-meta")).toBe(true);
  });

  it("gives production its own Worker, domain and self-reference", () => {
    expect(conf.name).toBe("dossierly-meta");
    expect(conf.vars?.APP_URL).toBe("https://dossierly.cosmiclan.com");
    expect(conf.services?.find((s) => s.binding === "WORKER_SELF_REFERENCE")?.service).toBe("dossierly-meta");
  });

  it("gives each preview its own Worker, domain and self-reference on shared preview storage", () => {
    const prodDb = conf.d1_databases![0].database_id;
    for (const p of previews) {
      const e = conf.env![p];
      expect(e.name).toBe(`dossierly-meta-${p}`);
      expect(e.vars?.APP_URL).toBe(`https://dossierly-${p}.cosmiclan.com`);
      expect(e.services?.find((s) => s.binding === "WORKER_SELF_REFERENCE")?.service).toBe(e.name);
      expect(e.d1_databases![0].database_id).not.toBe(prodDb);
      expect(e.r2_buckets![0].bucket_name).toBe("dossierly-meta-preview-blobs");
    }
  });

  it("binds the user, case, voice and model-relay Durable Objects everywhere", () => {
    for (const c of [conf, ...previews.map((p) => conf.env![p])]) {
      const names = c.durable_objects!.bindings.map((b) => b.name).sort();
      expect(names).toEqual(["CASE_DO", "MODEL_RELAY", "USER_DO", "VOICE_DO"]);
    }
  });
});
