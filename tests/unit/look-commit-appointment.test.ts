import { describe, expect, it } from "vitest";
import { warsawToUtc } from "@/lib/look/commit";

describe("warsawToUtc", () => {
  it("converts Warsaw wall-clock time in winter (CET, UTC+1)", () => {
    expect(warsawToUtc("2026-11-12", "10:30")).toBe("2026-11-12T09:30:00.000Z");
  });
  it("converts Warsaw wall-clock time in summer (CEST, UTC+2)", () => {
    expect(warsawToUtc("2027-06-15", "08:00")).toBe("2027-06-15T06:00:00.000Z");
  });
  it("handles times just after midnight", () => {
    expect(warsawToUtc("2026-12-01", "00:30")).toBe("2026-11-30T23:30:00.000Z");
  });
});
