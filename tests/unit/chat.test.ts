import { describe, expect, it } from "vitest";
import { buildArjunSeed } from "@/lib/dev/arjun-seed";
import { buildSystemPrompt, PERSONA } from "@/lib/chat/prompt";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { memorySql } from "@/lib/case/memory-sql";
import { CaseStore } from "@/lib/case/store";

const ok = { messages: [{ role: "user", content: "When is my next deadline?" }] };

describe("ChatRequestSchema", () => {
  it("accepts a user-last conversation with attachments", () => {
    expect(ChatRequestSchema.safeParse({ ...ok, attachments: [{ kind: "deadline", id: "d1" }] }).success).toBe(true);
  });
  it("rejects bad shapes", () => {
    expect(ChatRequestSchema.safeParse({ messages: [] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "assistant", content: "hi" }] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "user", content: "" }] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(4001) }] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ messages: [{ role: "system", content: "x" }] }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...ok, attachments: Array(6).fill({ kind: "task", id: "t" }) }).success).toBe(false);
    expect(ChatRequestSchema.safeParse({ ...ok, attachments: [{ kind: "email", id: "t" }] }).success).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  const store = new CaseStore(memorySql());
  const seed = buildArjunSeed("2026-11-04");
  store.patchProfile(seed.profile);
  const deadline = store.create("deadlines", seed.deadlines[0]);
  const snap = store.snapshot();

  it("includes persona, case context and attached detail; ignores unknown ids", () => {
    const { system, sources } = buildSystemPrompt(snap, [{ kind: "deadline", id: deadline.id }, { kind: "task", id: "nope" }], new Date("2026-11-04T10:00:00Z"));
    expect(system).toContain(PERSONA);
    expect(system).toContain("CASE (today is Wednesday 4 November 2026 (2026-11-04)");
    expect(system).toContain("ATTACHED BY THE USER");
    expect(system).toContain("KPA art. 64");
    expect(sources).toHaveLength(1);
  });
  it("omits the attached block when nothing resolves", () => {
    expect(buildSystemPrompt(snap, [{ kind: "task", id: "nope" }]).system).not.toContain("ATTACHED");
  });
});
