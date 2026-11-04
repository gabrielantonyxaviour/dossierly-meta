import { describe, expect, it } from "vitest";
import { memorySql } from "@/lib/case/memory-sql";
import { nextStep, warsawToday } from "@/lib/case/next-step";
import { CaseStore } from "@/lib/case/store";

const now = new Date("2026-11-04T10:00:00Z");

describe("nextStep", () => {
  it("returns a stage hint for an empty case", () => {
    expect(nextStep(new CaseStore(memorySql()).snapshot(), now)?.kind).toBe("stage");
  });

  it("prefers the earliest open deadline and flags overdue", () => {
    const s = new CaseStore(memorySql());
    s.create("deadlines", { title: "Later", dueDate: "2026-12-01" });
    s.create("deadlines", { title: "Missed?", dueDate: "2026-11-01" });
    s.create("deadlines", { title: "Done", dueDate: "2026-10-01", status: "done" });
    const n = nextStep(s.snapshot(), now);
    expect(n).toMatchObject({ title: "Missed?", overdue: true, daysLeft: -3 });
  });

  it("dates a task by its deadline and beats undated tasks and documents", () => {
    const s = new CaseStore(memorySql());
    s.create("tasks", { title: "Undated" });
    s.create("documents", { kind: "photo", title: "Photo", status: "missing" });
    const d = s.create("deadlines", { title: "UPO", dueDate: "2026-11-20" });
    s.create("tasks", { title: "Bring insurance", dueDeadlineId: d.id });
    const n = nextStep(s.snapshot(), now);
    expect(n?.kind).toBe("deadline");
    s.patch("deadlines", d.id, { status: "done" });
    expect(nextStep(s.snapshot(), now)?.title).toBe("Undated");
  });

  it("uses Warsaw calendar day and includes upcoming appointments", () => {
    expect(warsawToday(new Date("2026-11-04T23:30:00Z"))).toBe("2026-11-05");
    const s = new CaseStore(memorySql());
    s.create("appointments", { title: "Fingerprints", at: "2026-11-06T09:00:00+01:00" });
    expect(nextStep(s.snapshot(), now)).toMatchObject({ kind: "appointment", daysLeft: 2 });
  });
});

describe("warsawTime", () => {
  it("renders Warsaw wall-clock time regardless of the stored offset", async () => {
    const { warsawTime } = await import("@/lib/case/next-step");
    expect(warsawTime("2026-11-12T10:30:00+01:00")).toBe("10:30");
    expect(warsawTime("2026-11-12T09:30:00Z")).toBe("10:30");
    expect(warsawTime("2026-07-01T08:15:00Z")).toBe("10:15");
  });
});

describe("dayLabel", () => {
  it("spells out the weekday so prompts never need weekday arithmetic", async () => {
    const { dayLabel } = await import("@/lib/case/context");
    expect(dayLabel("2026-11-04")).toBe("Wednesday 4 November 2026 (2026-11-04)");
    expect(dayLabel("2026-11-18")).toBe("Wednesday 18 November 2026 (2026-11-18)");
    expect(dayLabel("soon")).toBe("soon");
  });
});
