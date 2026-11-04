import { describe, expect, it } from "vitest";
import { LineStream } from "@/lib/voice/server/lines";
import { dueInDays, looksPolish } from "@/lib/voice/server/util";
import { signTicket, verifyTicket } from "@/lib/voice/token";
import { ulaw8kToPcm16k } from "@/lib/voice/server/transport";

function run(chunks: string[]) {
  const sentences: string[] = [];
  const fields: Record<string, string> = {};
  const ls = new LineStream({ onField: (k, v) => (fields[k] = v), onSentence: (_k, s) => sentences.push(s) }, new Set(["SAY"]));
  for (const c of chunks) ls.push(c);
  ls.end();
  return { sentences, fields };
}

describe("LineStream", () => {
  it("releases SAY sentences while streaming and parses later fields", () => {
    const { sentences, fields } = run(["MODE: co", "ach\nSAY: Czy mogę wysłać ", "aneks online? Do osiemnastego.", "\nGLOSS: Can I send", " it online?\nWHY: She needs an annex."]);
    expect(fields.MODE).toBe("coach");
    expect(sentences).toEqual(["Czy mogę wysłać aneks online?", "Do osiemnastego."]);
    expect(fields.WHY).toBe("She needs an annex.");
  });
  it("treats unlabeled text as SAY and does not cut a sentence early", () => {
    const { sentences } = run(["Hello Ar", "jun. Your reply is due on the 18", "th"]);
    expect(sentences).toEqual(["Hello Arjun.", "Your reply is due on the 18th"]);
  });
  it("keeps multiple TASK lines", () => {
    const seen: string[] = [];
    const ls = new LineStream({ onField: (k, v) => k === "TASK" && seen.push(v) }, new Set(["SAY"]));
    ls.push("SAY: Done.\nTASK: A | b | none\nTASK: C | d | 2026-11-18");
    ls.end();
    expect(seen).toEqual(["A | b | none", "C | d | 2026-11-18"]);
  });
});

describe("looksPolish", () => {
  it.each([
    ["Czy ma pan ubezpieczenie zdrowotne na cały okres pobytu?", true],
    ["Proszę dostarczyć aneks w ciągu czternastu dni.", true],
    ["Yes, I have the NFZ student insurance.", false],
    ["मेरे पास बीमा है", false],
  ])("%s", (t, pl) => expect(looksPolish(t)).toBe(pl));
});

describe("dueInDays", () => {
  it("counts from the next day and moves off weekends", () => {
    expect(dueInDays(14, new Date("2026-11-04T10:00:00Z")).date).toBe("2026-11-18");
    expect(dueInDays(7, new Date("2026-11-04T10:00:00Z")).date).toBe("2026-11-12"); // 11 Nov is a holiday → 12 Nov
  });
});

describe("ticket", () => {
  it("round-trips, rejects tampering and expiry", async () => {
    const t = { u: "acct_1", s: "abcdefgh1234", m: "agent" as const, l: "en", e: Date.now() + 60_000 };
    const tok = await signTicket("secret", t);
    expect(await verifyTicket("secret", tok)).toMatchObject({ u: "acct_1" });
    expect(await verifyTicket("other", tok)).toBeNull();
    expect(await verifyTicket("secret", tok.replace(/^./, "x"))).toBeNull();
    expect(await verifyTicket("secret", await signTicket("secret", { ...t, e: Date.now() - 1 }))).toBeNull();
  });
});

describe("ulaw", () => {
  it("doubles the sample count", () => {
    expect(new Int16Array(ulaw8kToPcm16k(new Uint8Array([0xff, 0x00, 0x7f]))).length).toBe(6);
  });
});

describe("LineStream first clause", () => {
  it("starts speech on the first clause of a long opening sentence, then goes by sentence", () => {
    const said: string[] = [];
    const ls = new LineStream({ onField: () => undefined, onSentence: (_k, s) => said.push(s) }, new Set(["SAY"]));
    for (const d of ["SAY: The official says wait a moment, the address", " here is different. They're asking why."]) ls.push(d);
    ls.end();
    expect(said).toEqual(["The official says wait a moment,", "the address here is different.", "They're asking why."]);
  });
  it("does not cut a short opening at a comma", () => {
    const said: string[] = [];
    const ls = new LineStream({ onField: () => undefined, onSentence: (_k, s) => said.push(s) }, new Set(["SAY"]));
    ls.push("SAY: Yes, she is asking for the lease.");
    ls.end();
    expect(said).toEqual(["Yes, she is asking for the lease."]);
  });
});
