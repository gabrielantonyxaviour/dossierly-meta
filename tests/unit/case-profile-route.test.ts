import { describe, expect, it } from "vitest";
import { stripServerOnlyProfileFields } from "@/lib/case/profile-input";

describe("PATCH /api/case/profile input", () => {
  it("drops client-set phone verification and call permission", () => {
    expect(stripServerOnlyProfileFields({ fullName: "Arjun Raman", phone: { number: "+48500100200", verified: true, callsEnabled: true } }))
      .toEqual({ fullName: "Arjun Raman", phone: { number: "+48500100200" } });
  });
  it("leaves other fields and non-object bodies untouched", () => {
    expect(stripServerOnlyProfileFields({ city: "Warszawa" })).toEqual({ city: "Warszawa" });
    expect(stripServerOnlyProfileFields(null)).toBeNull();
    expect(stripServerOnlyProfileFields({ phone: null })).toEqual({ phone: null });
  });
});
