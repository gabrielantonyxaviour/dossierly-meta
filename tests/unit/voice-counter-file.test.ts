import { describe, expect, it, vi } from "vitest";
import { storedFile } from "@/lib/voice/server/modes/counter";
import { storeSeedFiles } from "@/lib/dev/arjun-seed";
import type { CaseDocument } from "@/lib/case/types";

const doc = (fileKey: string | null): CaseDocument => ({
  id: "doc-rental", kind: "rental_agreement", title: "Lease", status: "have", fileKey, pages: 1, extractedFields: {}, source: "email", createdAt: "2026-11-04T08:00:00.000Z",
});

describe("Counter: the official sees the stored document itself", () => {
  it("serves a stored page image or PDF through the case file route", () => {
    expect(storedFile(doc("case/u1/doc-rental.png"))).toEqual({ url: "/api/case/documents/doc-rental/file", type: "image" });
    expect(storedFile(doc("case/u1/lease.PDF"))).toEqual({ url: "/api/case/documents/doc-rental/file", type: "pdf" });
  });
  it("falls back to the details when there is no renderable file", () => {
    expect(storedFile(doc(null))).toBeNull();
    expect(storedFile(doc("case/u1/lease.docx"))).toBeNull();
  });
  it("the seeded lease page is copied into the person's own case storage", async () => {
    const put = vi.fn(async () => undefined);
    const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    expect(await storeSeedFiles({ BLOBS: { put }, ASSETS: { fetch } }, "u_abc")).toEqual({ "doc-rental": "case/u_abc/doc-rental.png" });
    expect(fetch).toHaveBeenCalledWith("https://assets.local/sample/letters/umowa-najmu.png");
    expect(put).toHaveBeenCalledWith("case/u_abc/doc-rental.png", expect.any(ArrayBuffer));
    expect(await storeSeedFiles({ BLOBS: { put } }, "u_abc")).toEqual({});
  });
});
