import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/onboarding/intake", () => ({
  intakeTurn: vi.fn(),
  INTAKE_REPLY_SYSTEM: "reply rules",
  intakeInput: (t: string) => `Transcript: "${t}"`,
  intakeProfile: vi.fn(async () => ({ profile: { fullName: "Arjun Raman", preferredLanguage: "en" }, firstName: "Arjun", language: "en" })),
}));
const stream = vi.fn(async (_env: unknown, _a: unknown, h: { onSentence?: (k: string, s: string) => void }) => {
  h.onSentence?.("SAY", "Hi Arjun.");
  h.onSentence?.("SAY", "Can I look at your email?");
  return { fields: { SAY: "Hi Arjun. Can I look at your email?", LANG: "en" }, model: "m", firstTokenMs: 1 };
});
vi.mock("@/lib/voice/server/llm", () => ({ streamLines: (...a: unknown[]) => stream(...(a as [never, never, never])) }));

import { IntakeMode } from "@/lib/voice/server/modes/intake";
import { intakeTurn } from "@/lib/onboarding/intake";

function fakeSession() {
  const log: string[] = [];
  const s = {
    lang: "en", env: {}, ticket: { u: "u_1" },
    emit: (ev: { t: string; turn?: { who: string; partial?: boolean } }) => log.push(ev.t === "turn" ? `turn:${ev.turn!.who}${ev.turn!.partial ? "~" : ""}` : ev.t),
    sentenceReady: () => log.push("ready"),
    speaker: { say: (_id: string, s: string) => log.push(`say:${s}`), end: () => log.push("end"), whenPlayed: () => new Promise(() => undefined) },
    finish: async () => undefined,
  };
  return { s, log };
}
const utt = { id: "t1", text: "Hi, I'm Arjun, a student", via: "mic" as const, metric: { turnId: "t1", t0: 0 } };

describe("intake mode, streamed reply", () => {
  it("speaks sentence by sentence, then sends the profile", async () => {
    const { s, log } = fakeSession();
    await new IntakeMode(s as never).utterance(utt, new AbortController().signal);
    expect(log).toEqual(["turn:user", "ready", "say:Hi Arjun.", "turn:agent~", "say:Can I look at your email?", "turn:agent~", "end", "turn:agent", "intake"]);
  });
  it("retries the reply once when the model fails before speaking", async () => {
    stream.mockImplementationOnce(async () => { throw new Error("This model is briefly unavailable"); });
    const { s, log } = fakeSession();
    await new IntakeMode(s as never).utterance(utt, new AbortController().signal);
    expect(log.filter((x) => x.startsWith("say:"))).toHaveLength(2);
    expect(log.at(-1)).toBe("intake");
  });
  it("falls back to the one-shot intakeTurn when the stream yields no sentence twice", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    stream.mockImplementationOnce(async () => ({ fields: {}, model: "m", firstTokenMs: null }) as never);
    stream.mockImplementationOnce(async () => { throw new Error("This model is briefly unavailable"); });
    vi.mocked(intakeTurn).mockImplementationOnce((async (_e: unknown, _u: string, _t: string, o?: { onReply?: (r: string, l: string) => void }) => {
      o?.onReply?.("Hi Arjun. Can I look at your email?", "en");
      return { reply: "Hi Arjun. Can I look at your email?", language: "en", profile: { fullName: "Arjun Raman" }, firstName: "Arjun" };
    }) as never);
    const { s, log } = fakeSession();
    await new IntakeMode(s as never).utterance(utt, new AbortController().signal);
    expect(log.filter((x) => x.startsWith("say:"))).toEqual(["say:Hi Arjun. Can I look at your email?"]);
    expect(log).not.toContain("error");
    expect(log.at(-1)).toBe("intake");
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
