import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { MESSAGES, type Namespace } from "@/messages";
import { LOCALES, pickLocale } from "@/lib/i18n/locales";
import { translator } from "@/lib/i18n/translate";

const TRANSLATED = LOCALES.filter((l) => l !== "en");
const namespaces = Object.keys(MESSAGES.en) as Namespace[];
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("message catalogue", () => {
  it("registers every English JSON file", () => {
    const files = readdirSync(join(__dirname, "../../src/messages/en")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    expect(namespaces.sort()).toEqual(files.sort());
  });

  for (const ns of namespaces) {
    const en = MESSAGES.en[ns] as Record<string, string>;
    it(`${ns}: English strings are non-empty`, () => {
      for (const [k, v] of Object.entries(en)) expect(v.trim(), `${ns}.${k}`).not.toBe("");
    });
    for (const loc of TRANSLATED) {
      const dict = (MESSAGES[loc][ns] ?? {}) as Record<string, string>;
      it(`${ns}: ${loc} has every key, non-empty`, () => {
        const missing = Object.keys(en).filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
        expect(missing, `${loc}/${ns}.json missing`).toEqual([]);
      });
      it(`${ns}: ${loc} has no stray keys`, () => {
        expect(Object.keys(dict).filter((k) => !(k in en)), `${loc}/${ns}.json extra`).toEqual([]);
      });
      it(`${ns}: ${loc} keeps every {placeholder}`, () => {
        const bad = Object.keys(en).filter((k) => typeof dict[k] === "string" && vars(dict[k]).join() !== vars(en[k]).join());
        expect(bad, `${loc}/${ns}.json placeholder mismatch`).toEqual([]);
      });
    }
  }
});

describe("pickLocale", () => {
  it("prefers the cookie", () => expect(pickLocale("uk", "hi-IN,en;q=0.8")).toBe("uk"));
  it("ignores an unknown cookie and uses Accept-Language order", () => {
    expect(pickLocale("pl", "pl-PL,ta-IN;q=0.9,en;q=0.8")).toBe("ta");
    expect(pickLocale(undefined, "HI-in")).toBe("hi");
  });
  it("falls back to English", () => {
    expect(pickLocale(undefined, null)).toBe("en");
    expect(pickLocale(undefined, "pl-PL,de;q=0.9")).toBe("en");
  });
});

describe("translator", () => {
  it("fills {vars} and falls back to English, then the key", () => {
    const t = translator("hi", "time");
    expect(t("inDays", { n: 3 })).toContain("3");
    expect(translator("ta", "pricing")("__missing__")).toBe("__missing__");
  });
});
