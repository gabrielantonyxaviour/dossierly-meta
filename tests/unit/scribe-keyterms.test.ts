import { describe, expect, it } from "vitest";
import { KEYTERM_MAX, realtimeUrl, scribeKeyterms } from "@/lib/voice/server/asr";

describe("Scribe keyterms stay within ElevenLabs' 20-character limit", () => {
  it("splits a long phrase into its words and drops anything still too long", () => {
    const out = scribeKeyterms(["ubezpieczenie zdrowotne", "karta pobytu", "Wydział Spraw Cudzoziemców", "WSC-II-P.6151.48213.2026"]);
    expect(out).toEqual(expect.arrayContaining(["ubezpieczenie", "zdrowotne", "karta pobytu", "Wydział", "Spraw", "Cudzoziemców"]));
    expect(out.every((k) => k.length <= KEYTERM_MAX)).toBe(true);
    expect(out).not.toContain("WSC-II-P.6151.48213.2026");
  });
  it("never puts an over-long keyterm in the realtime URL", () => {
    const url = new URL(realtimeUrl("wss://api.elevenlabs.io", "scribe_v3_live", { languageBias: ["pl"], keywords: ["ubezpieczenie zdrowotne", "zaświadczenie o zatrudnieniu"] }));
    const terms = url.searchParams.getAll("keyterms");
    expect(terms.length).toBeGreaterThan(0);
    expect(terms.every((k) => k.length <= KEYTERM_MAX)).toBe(true);
  });
});
