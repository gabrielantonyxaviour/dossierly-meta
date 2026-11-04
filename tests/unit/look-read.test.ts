import { describe, expect, it } from "vitest";
import { gridBoxToPx, groundedLines, readLook, toLookRead, type RawLines, type RawRead } from "@/lib/look/read";
import type { ChatClient, ChatRequest } from "@/lib/model/types";
import { freshLocalEnv } from "@/lib/server/local";

const size = { w: 1000, h: 2000 };
const box = (x1: number, y1: number, x2: number, y2: number) => ({ x_min: x1, y_min: y1, x_max: x2, y_max: y2 });
const lines: RawLines = {
  lines: [
    { n: 1, text: "Znak sprawy: WSC-II-S.6151.48213.2026", bbox: box(500, 100, 900, 120) },
    { n: 2, text: "1. przedłożenie umowy najmu,", bbox: box(100, 400, 600, 420) },
    { n: 3, text: "w terminie 14 dni od dnia doręczenia", bbox: box(100, 500, 800, 520) },
    { n: 4, text: "niniejszego wezwania.", bbox: box(100, 520, 400, 540) },
    { n: 5, text: "Imię", bbox: box(100, 600, 300, 610) },
    { n: 6, text: "", bbox: box(100, 612, 900, 640) },
    { n: 7, text: "degenerate", bbox: box(100, 700, 101, 701) },
  ],
};
const raw: RawRead = {
  kind: "letter",
  readable: true,
  title: "Summons to complete missing documents 補",
  summary: "You must send documents.",
  actions: ["Send the documents", "Keep the receipt"],
  items: [
    { id: "i1", role: "deadline", label: "Your deadline", text: "w terminie 14 dni od dnia doręczenia niniejszego wezwania.", meaning: "14 days from delivery." },
    { id: "i2", role: "case_number", label: "Case number", text: "Znak sprawy: WSC-II-S.6151.48213.2026", meaning: "Your reference." },
    { id: "i3", role: "documents", label: "Document 1", text: "1. przedłożenie umowy najmu", meaning: "Rental agreement." },
    { id: "i4", role: "other", label: "Ghost", text: "this sentence is nowhere on the page", meaning: "x" },
    { id: "i5", role: "field", label: "Name field", text: "Imię", meaning: "Given name", value: " Arjun " },
  ],
  facts: { caseNumber: "WSC-II-S.6151.48213.2026", filedAt: "18.09.2026 14:07", mosStatus: "", extra: "ignored" },
  letter: {
    dateOnLetter: "2026-10-22",
    asks: ["Rental agreement"],
    asksLocal: ["przedłożenie umowy najmu"],
    deadlineRule: { amount: 14, unit: "days", from: "delivery", quote: "w terminie 14 dni" },
    legalBasis: "art. 64 § 2 KPA",
  },
  uncertain: ["i2", "caseNumber", "i4"],
};

describe("gridBoxToPx", () => {
  it("clamps values above 1000, swaps reversed corners and scales to pixels", () => {
    expect(gridBoxToPx(box(500, 250, 1200, -5), size)).toEqual([500, 0, 1000, 500]);
  });
  it("drops degenerate boxes", () => {
    expect(gridBoxToPx(box(100, 100, 102, 300), size)).toBeNull();
  });
});

describe("toLookRead", () => {
  const ground = groundedLines(lines, size);
  const read = toLookRead(raw, ground, undefined);

  it("places items on the grounded lines (union for a wrapped sentence) in source pixels", () => {
    expect(ground).toHaveLength(6);
    const byRole = Object.fromEntries(read.items.map((i) => [i.label, i]));
    expect(byRole["Case number"].box).toEqual([500, 200, 900, 240]);
    expect(byRole["Your deadline"].box).toEqual([100, 1000, 800, 1080]);
  });

  it("drops items whose text cannot be found on the page and renumbers the rest", () => {
    expect(read.items.map((i) => i.id)).toEqual(["i1", "i2", "i3", "i4"]);
    expect(read.items.some((i) => i.label === "Ghost")).toBe(false);
    expect(read.uncertain).toEqual(["i2", "caseNumber"]); // the dropped item i4 must not be re-pointed at the item renumbered to i4
  });

  it("boxes a form field together with the input under its label and keeps the case value", () => {
    const f = read.items.find((i) => i.label === "Name field")!;
    expect(f.role).toBe("field");
    expect(f.box).toEqual([100, 1200, 900, 1280]);
    expect(f.value).toBe("Arjun");
  });

  it("keeps only known fact keys, normalises dates and strips stray CJK", () => {
    expect(read.facts).toEqual({ caseNumber: "WSC-II-S.6151.48213.2026", filedAt: "2026-09-18" });
    expect(read.title).toBe("Summons to complete missing documents");
  });

  it("normalises the letter block", () => {
    expect(read.letter).toEqual({ ...raw.letter, deadlineRule: { amount: 14, unit: "days", from: "delivery", quote: "w terminie 14 dni" } });
  });

  it("falls back to role other for an unknown role", () => {
    const r = toLookRead({ ...raw, items: [{ id: "i1", role: "bogus", label: "X", text: "Znak sprawy: WSC-II-S.6151.48213.2026", meaning: "m" }] }, ground);
    expect(r.items[0].role).toBe("other");
  });

  it("returns no letter for screens and no items for an unreadable image", () => {
    expect(toLookRead({ ...raw, kind: "upo" }, ground).letter).toBeNull();
    const bad = toLookRead({ readable: false, title: "Not a document", summary: "A cat.", items: raw.items }, ground);
    expect(bad.readable).toBe(false);
    expect(bad.items).toEqual([]);
  });

  it("rejects a nonsense deadline period instead of passing it on", () => {
    const r = toLookRead({ ...raw, letter: { ...raw.letter!, deadlineRule: { amount: -3, unit: "fortnights", from: "never", quote: "q" } } }, ground);
    expect(r.letter!.deadlineRule).toEqual({ amount: null, unit: null, from: null, quote: "q" });
  });
});

describe("readLook", () => {
  const env = freshLocalEnv({ MODEL_API_KEY: "k" });
  const req = { image: "data:image/png;base64,AAAA", width: 1000, height: 2000 };

  function client(opts: { failGrounding?: boolean } = {}) {
    const calls: ChatRequest[] = [];
    const c: ChatClient = {
      async chat(r) {
        calls.push(r);
        const isGround = typeof r.messages[0].content === "string" && r.messages[0].content.includes("Transcribe the document line by line");
        if (isGround && opts.failGrounding) throw new Error("grounding down");
        const payload = isGround ? lines : raw;
        return { content: JSON.stringify(payload), usage: { tokensIn: 100, tokensOut: 50, cachedTokens: 0 } };
      },
    };
    return { c, calls };
  }

  it("makes one grounding call and one reading call on the same image, and joins them", async () => {
    const { c, calls } = client();
    const out = await readLook(env, "u1", req, "CASE (today 2026-11-04)", { client: c, fullName: "Arjun Raman" });
    expect(calls).toHaveLength(2);
    expect(calls.every((x) => x.role === "vision")).toBe(true);
    expect(out.items.length).toBe(4);
    const user = calls.map((x) => JSON.stringify(x.messages[1].content));
    expect(user.every((u) => u.includes("data:image/png;base64,AAAA"))).toBe(true);
  });

  it("masks the applicant's name in the case context but still gives the model given name and surname apart", async () => {
    const { c, calls } = client();
    await readLook(env, "u1", req, "Profile: Arjun Raman; language en", { client: c, fullName: "Arjun Raman" });
    const readingUser = JSON.stringify(calls.find((x) => String(x.messages[0].content).includes("pick out the important items"))!.messages[1].content);
    expect(readingUser).not.toContain("Arjun");
    expect(readingUser).not.toContain("Raman");
  });

  it("still returns the reading, without items, when the grounding call fails", async () => {
    const { c } = client({ failGrounding: true });
    const out = await readLook(env, "u1", req, "CASE", { client: c });
    expect(out.items).toEqual([]);
    expect(out.title).toContain("Summons");
  });
});
