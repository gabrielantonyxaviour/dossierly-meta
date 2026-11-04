import { beforeEach, describe, expect, it, vi } from "vitest";
import { caseClient } from "@/lib/case/client";

const order: string[] = [];
vi.mock("@/lib/model", async (orig) => ({
  ...(await orig<typeof import("@/lib/model")>()),
  runModel: vi.fn(async (_ctx: unknown, call: { system: string }) => {
    if (call.system.startsWith("You are Dossierly")) {
      await new Promise((r) => setTimeout(r, 5));
      order.push("reply");
      return { data: { reply: "Hi Arjun. Can I look at your email? That's where the office writes to you.", language: "en" } };
    }
    await new Promise((r) => setTimeout(r, 40));
    order.push("extract");
    return { data: { firstName: "Arjun", fullName: null, language: "en", reason: "study", city: null } };
  }),
}));

const { intakeTurn } = await import("@/lib/onboarding/intake");
const transcript = "Uh hi. I'm Arjun, student. I've got a letter I can't read and fingerprints tomorrow. Today. Ten forty.";

describe("voice intake", () => {
  beforeEach(() => { order.length = 0; });

  it("hands over the spoken reply before the profile extraction finishes, then saves the profile", async () => {
    const userId = "intake-arjun-1";
    const onReply = vi.fn(() => order.push("onReply"));
    const r = await intakeTurn({} as never, userId, transcript, { onReply });
    expect(order).toEqual(["reply", "onReply", "extract"]);
    expect(onReply).toHaveBeenCalledWith("Hi Arjun. Can I look at your email? That's where the office writes to you.", "en");
    expect(r).toMatchObject({ reply: expect.stringContaining("Hi Arjun"), language: "en", firstName: "Arjun" });
    const saved = (await caseClient(userId).snapshot()).profile;
    expect(saved).toMatchObject({ fullName: "Arjun", permitType: "temporary_residence_study", preferredLanguage: "en" });
  });

  it("with defer, returns the merged profile and saves it in the background", async () => {
    const userId = "intake-arjun-2";
    const work: Promise<unknown>[] = [];
    const r = await intakeTurn({} as never, userId, transcript, { defer: (p) => work.push(p) });
    expect(r.profile).toMatchObject({ fullName: "Arjun", permitType: "temporary_residence_study" });
    await Promise.all(work);
    expect((await caseClient(userId).snapshot()).profile.fullName).toBe("Arjun");
  });
});
