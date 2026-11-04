import { describe, expect, it, vi } from "vitest";

let release: () => void = () => undefined;
vi.mock("@/lib/onboarding/intake", () => ({
  // Older onboarding module: no streaming exports, so IntakeMode uses the one-shot intakeTurn.
  INTAKE_REPLY_SYSTEM: undefined,
  intakeInput: undefined,
  intakeProfile: undefined,
  intakeTurn: vi.fn(async (_e: unknown, _u: string, _t: string, o?: { onReply?: (r: string, l: string) => void }) => {
    o?.onReply?.("Hi Arjun. Can I look at your email?", "en");
    await new Promise<void>((r) => (release = r)); // extraction still running
    return { reply: "Hi Arjun. Can I look at your email?", language: "en", profile: { fullName: "Arjun Raman" }, firstName: "Arjun" };
  }),
}));

import { IntakeMode } from "@/lib/voice/server/modes/intake";
import { intakeTurn } from "@/lib/onboarding/intake";

function fakeSession() {
  const log: string[] = [];
  const s = {
    lang: "en", env: {}, ticket: { u: "u_1" },
    emit: (ev: { t: string; turn?: { who: string } }) => log.push(ev.t === "turn" ? `turn:${ev.turn!.who}` : ev.t),
    sentenceReady: () => log.push("ready"),
    speaker: { say: () => log.push("say"), end: () => undefined, whenPlayed: () => new Promise(() => undefined) },
    finish: async () => undefined,
  };
  return { s, log };
}
const utt = { id: "t1", text: "Hi, I'm Arjun, a student", via: "mic" as const, metric: { turnId: "t1", t0: 0 } };

describe("intake mode", () => {
  it("speaks from onReply before the profile extraction finishes, then sends the profile", async () => {
    const { s, log } = fakeSession();
    const p = new IntakeMode(s as never).utterance(utt, new AbortController().signal);
    await Promise.resolve();
    expect(log).toEqual(["turn:user", "ready", "say", "turn:agent"]);
    release();
    await p;
    expect(log.filter((x) => x === "say")).toHaveLength(1);
    expect(log.at(-1)).toBe("intake");
  });
  it("stays silent on a speculative turn that was redone", async () => {
    const { s, log } = fakeSession();
    const ctl = new AbortController();
    ctl.abort();
    const p = new IntakeMode(s as never).utterance(utt, ctl.signal);
    await Promise.resolve();
    release();
    await p;
    expect(log).toEqual(["turn:user"]);
  });
  it("retries once when the model fails, and speaks once", async () => {
    vi.mocked(intakeTurn).mockImplementationOnce(async () => {
      throw new Error("Model returned an empty reply");
    });
    const { s, log } = fakeSession();
    const p = new IntakeMode(s as never).utterance(utt, new AbortController().signal);
    await new Promise((r) => setTimeout(r, 0));
    release();
    await p;
    expect(log.filter((x) => x === "say")).toHaveLength(1);
    expect(log.at(-1)).toBe("intake");
  });
});
