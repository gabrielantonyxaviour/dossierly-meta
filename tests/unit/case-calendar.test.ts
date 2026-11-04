import { describe, expect, it } from "vitest";
import { deadlineWindow, monthGrid, monthLabel, shiftMonth, type DateItem } from "@/components/app/case/calendar-grid";

describe("case calendar grid", () => {
  it("covers November 2026 in Monday-first weeks", () => {
    const g = monthGrid("2026-11");
    expect(g.length % 7).toBe(0);
    expect(g[0].date).toBe("2026-10-26"); // 1 Nov 2026 is a Sunday
    expect(g.find((c) => c.date === "2026-11-01")?.inMonth).toBe(true);
    expect(g.at(-1)?.date).toBe("2026-12-06");
    expect(g.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it("starts on the 1st when the month begins on a Monday", () => {
    expect(monthGrid("2027-02")[0].date).toBe("2027-02-01");
    expect(monthGrid("2027-02")).toHaveLength(28);
  });
  it("shifts months across the year", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-11")).toBe("November 2026");
  });
  it("shades the days up to the nearest open deadline only", () => {
    const items: DateItem[] = [
      { key: "a", date: "2026-11-19", kind: "deadline", title: "Reply to the summons", sub: "", status: "open" },
      { key: "b", date: "2026-11-25", kind: "deadline", title: "Certificate", sub: "", status: "open" },
      { key: "c", date: "2026-11-05", kind: "appointment", title: "Fingerprints", sub: "" },
      { key: "d", date: "2026-11-10", kind: "deadline", title: "Done one", sub: "", status: "done" },
    ];
    expect(deadlineWindow(items, "2026-11-05")).toEqual({ from: "2026-11-05", to: "2026-11-19" });
    expect(deadlineWindow(items.filter((i) => i.kind !== "deadline"), "2026-11-05")).toBeNull();
  });
});
