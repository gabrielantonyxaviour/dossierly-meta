import { describe, expect, it } from "vitest";
import { caseClient } from "@/lib/case/client";
import { writeReadyScene } from "@/lib/dev/ready-scene";
import { freshLocalEnv } from "@/lib/server/local";
import { latestReady, isFresh } from "@/components/app/ready/derive";
import { deriveNotices } from "@/components/app/notifications/derive";
import { shortAddress, shortRule, shortTitle } from "@/components/app/case/KeyCards";

void freshLocalEnv();
const NOW = new Date("2026-11-04T17:30:00Z"); // 18:30 Warsaw, the evening of the recording day

describe("Ready for you (contract a–d)", () => {
  it("finds nothing until the agent has prepared something for a letter", async () => {
    const snap = await caseClient("rd-empty").snapshot();
    expect(latestReady(snap, NOW)).toBeNull();
  });

  it("bundles the letter, deadline, both drafts, the pending 09:00 reminder and the call", async () => {
    await writeReadyScene("rd-1", NOW);
    const snap = await caseClient("rd-1").snapshot();
    const b = latestReady(snap, NOW)!;
    expect(b.letter.id).toBe("doc-enrol-letter");
    expect(b.deadline?.dueDate).toBe("2026-11-25");
    expect(b.drafts.map((d) => d.language).sort()).toEqual(["en", "pl"]);
    expect(b.drafts.find((d) => d.language === "pl")?.text).toContain("Sygn. sprawy");
    expect(b.reminder?.at).toBe("2026-11-05T09:00:00+01:00");
    expect(b.call?.type).toBe("call");
    expect(isFresh(b, NOW)).toBe(true);
    expect(isFresh(b, new Date("2026-11-09T12:00:00Z"))).toBe(false);
  });

  it("is idempotent and notifications open /app/ready for the arrival and the call", async () => {
    await writeReadyScene("rd-2", NOW);
    await writeReadyScene("rd-2", NOW);
    const snap = await caseClient("rd-2").snapshot();
    expect(snap.documents.filter((d) => d.source === "agent")).toHaveLength(2);
    const notices = deriveNotices(snap, NOW);
    const letter = notices.find((n) => n.title === "New letter from the office");
    const call = notices.find((n) => n.title === "Dossierly called you");
    expect(letter?.href).toBe("/app/ready");
    expect(letter?.body).toContain("drafted 2 replies");
    expect(call?.href).toBe("/app/ready");
  });

  it("ignores drafts that point at another letter", async () => {
    const cc = caseClient("rd-3");
    await cc.create("documents", { id: "l1", kind: "letter", title: "Office letter", status: "have", pages: 1, source: "email", extractedFields: {} });
    await cc.create("documents", { id: "d1", kind: "letter", title: "Reply", status: "have", pages: null, source: "agent", extractedFields: { draft: "Text", triggeredBy: "other" } });
    expect(latestReady(await cc.snapshot(), NOW)).toBeNull();
  });
});

describe("case key-card labels", () => {
  it("shortens titles, addresses and rules for the A4 cards", () => {
    expect(shortTitle("Reply to summons: submit missing health insurance")).toBe("Reply to summons");
    expect(shortTitle("Fingerprints (odciski palców)")).toBe("Fingerprints");
    expect(shortAddress("ul. Marszałkowska 3/5, 00-624 Warszawa")).toBe("Marszałkowska 3/5");
    expect(shortRule("KPA art. 64 § 2")).toBe("KPA 64 §2");
  });
});
