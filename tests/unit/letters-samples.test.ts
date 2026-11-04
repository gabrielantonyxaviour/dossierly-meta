import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DORM_ADDRESS, FILM_MAILS, FILM_SEED, FLAT_ADDRESS } from "@/lib/features/film-mails";
import { SAMPLE_CASE_NO, SAMPLE_FOOTER_PL, SAMPLE_LETTERS, SAMPLE_SCREENS, SAMPLE_SENDER } from "@/lib/features/letters-samples";
import { GET, POST } from "@/app/api/letters/samples/route";
import { getEnv } from "@/lib/server/env";

const pub = (p: string) => existsSync(join(process.cwd(), "public", p));
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x/api/letters/samples", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("sample catalogue", () => {
  it("has unique ids and existing files", () => {
    const ids = [...SAMPLE_LETTERS, ...SAMPLE_SCREENS].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of SAMPLE_LETTERS) for (const p of [l.png, l.pdf, l.phonePhoto]) if (p) expect(pub(p), p).toBe(true);
    for (const s of SAMPLE_SCREENS) expect(pub(s.png), s.png).toBe(true);
  });
  it("marks every email as a fictional sample with the case number", () => {
    expect(SAMPLE_SENDER.email).not.toMatch(/gov\.pl/);
    for (const l of SAMPLE_LETTERS) {
      for (const part of [l.email.subject, l.email.text, l.email.html]) expect(part).toContain("PRZYKŁAD");
      expect(l.email.subject.startsWith("[PRZYKŁAD]")).toBe(true);
      expect(l.email.text).toContain(SAMPLE_FOOTER_PL);
      expect(l.email.text).toContain(SAMPLE_CASE_NO);
      expect(l.email.text).toContain("Mazowiecki Urząd Wojewódzki w Warszawie, Wydział Spraw Cudzoziemców");
    }
    const braki = SAMPLE_LETTERS[0].email.text;
    expect(braki).toContain("w terminie 14 dni od dnia doręczenia niniejszego wezwania, pod rygorem pozostawienia wniosku bez rozpoznania");
    expect(SAMPLE_LETTERS[1].email.text).toMatch(/04\.11\.2026 r\. o godz\. 10:40.*Marszałkowska 3\/5/);
    expect(braki).toMatch(/umowy najmu[\s\S]*ubezpieczenia zdrowotnego na cały okres pobytu[\s\S]*fotografii/);
  });
  it("GET omits email bodies", async () => {
    const json = await (await GET()).json();
    expect(JSON.stringify(json)).not.toContain("Uprzejmie informujemy");
    expect(json.letters).toHaveLength(SAMPLE_LETTERS.length);
  });
});

describe("sample email route", () => {
  const withEnv = (extra: Record<string, unknown>) => {
    const env = getEnv() as unknown as Record<string, unknown>;
    const send = vi.fn(async () => ({ messageId: "m1" }));
    const saved = { ...env };
    Object.assign(env, { EMAIL: { send }, ...extra });
    return { send, restore: () => { for (const k of Object.keys(extra).concat("EMAIL")) { if (k in saved) env[k] = saved[k]; else delete env[k]; } } };
  };
  it("rejects unknown ids with 400", async () => {
    const t = withEnv({});
    const res = await POST(post({ id: "nope" }));
    t.restore();
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("unknown_sample");
  });
  it("disables the admin path when the token is unset", async () => {
    const t = withEnv({ SAMPLE_MAIL_TOKEN: "" });
    const res = await POST(post({ id: "wezwanie-braki", to: "darthstormer.ai@gmail.com" }, { "x-sample-token": "anything" }));
    t.restore();
    expect(res.status).toBe(401);
    expect(t.send).not.toHaveBeenCalled();
  });
  it("rejects non-allowlisted recipients and sends to the allowlisted one", async () => {
    const t = withEnv({ SAMPLE_MAIL_TOKEN: "tok-123" });
    const bad = await POST(post({ id: "wezwanie-braki", to: "someone@example.com" }, { "x-sample-token": "tok-123" }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("recipient_not_allowed");
    const ok = await POST(post({ id: "wezwanie-braki", to: "darthstormer.ai@gmail.com" }, { "x-sample-token": "tok-123" }));
    t.restore();
    expect(ok.status).toBe(200);
    expect(t.send).toHaveBeenCalledTimes(1);
  });
  it("requires a session without a token", async () => {
    const t = withEnv({});
    const res = await POST(post({ id: "wezwanie-braki" }));
    t.restore();
    expect(res.status).toBe(401);
  });
});

describe("film inbox mails", () => {
  it("are marked as samples and carry the canonical facts in the body", () => {
    for (const id of [...FILM_SEED, "film-enrolment-request"]) {
      const m = FILM_MAILS[id]({ date: "2026-11-04" });
      expect(m.from.name, id).toContain("(PRZYKŁAD)");
      expect(m.from.email).not.toMatch(/gov\.pl/);
      expect(m.text, id).toContain(SAMPLE_FOOTER_PL);
      for (const p of m.attachments) expect(pub(p), p).toBe(true);
    }
    const t = (id: string, date = "2026-11-04") => FILM_MAILS[id]({ date }).text;
    expect(t("film-summons")).toContain(DORM_ADDRESS);
    expect(t("film-summons")).toContain("w terminie 14 dni od dnia doręczenia niniejszego wezwania");
    expect(t("film-summons")).toContain("22.10.2026");
    expect(t("film-fingerprints", "2026-11-05")).toMatch(/05\.11\.2026 r\., godz\. 10:40[\s\S]*Marszałkowska 3\/5/);
    for (const f of [SAMPLE_CASE_NO, "18.09.2026", DORM_ADDRESS]) expect(t("film-mos-confirmation")).toContain(f);
    expect(t("film-lease")).toContain(FLAT_ADDRESS);
    expect(t("film-lease")).toContain("1 October 2026");
    expect(t("film-agency")).toContain("Kompleksowa legalizacja pobytu: 4 900 zł");
    expect(t("film-enrolment-request")).toContain("25.11.2026");
    expect(FILM_SEED.at(-1)).toBe("film-summons");
  });
  it("route sends a film mail with the given date and its PDF", async () => {
    const env = getEnv() as unknown as Record<string, unknown>;
    const send = vi.fn(async (_m: Record<string, unknown>) => ({ messageId: "m2" }));
    const saved = { EMAIL: env.EMAIL, SAMPLE_MAIL_TOKEN: env.SAMPLE_MAIL_TOKEN };
    Object.assign(env, { EMAIL: { send }, SAMPLE_MAIL_TOKEN: "tok-9" });
    const res = await POST(post({ id: "film-fingerprints", to: "darthstormer.ai@gmail.com", date: "2026-11-05" }, { "x-sample-token": "tok-9" }));
    Object.assign(env, saved);
    expect(res.status).toBe(200);
    const msg = send.mock.calls[0][0] as { subject: string; from: { name: string } };
    expect(msg.subject).toContain("05.11.2026");
    expect(msg.from.name).toContain("PRZYKŁAD");
  });
});
