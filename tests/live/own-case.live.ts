import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { makeSamplePdf, newPage, note, noHorizontalScroll, SAMPLE_PNG, shot } from "./helpers";

// One fresh own-case user flows through every test in order (serial), exactly as a real new visitor would.
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;
const TAG = "own";

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, baseURL: "https://dossierly.pages.dev" });
  page = await newPage(context, TAG);
});
test.afterAll(async () => context.close());

test("1a onboarding: landing -> Start my own case -> case home", async () => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.getByRole("link", { name: "Start my own case" }).first().click();
  await expect(page.getByRole("heading", { name: "Open a case file" })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Your name").fill("Maya Kowalczyk-Test");
  await expect(page.getByRole("radio", { name: /English/ })).toBeChecked();
  const first = await page.locator("select.input option").first().textContent();
  note("onboarding", { firstOffice: first });
  await page.getByRole("button", { name: "Create my case" }).click();
  await expect(page.getByRole("heading", { name: "Maya's case" })).toBeVisible({ timeout: 30_000 });
  expect(await noHorizontalScroll(page)).toBe(true);
  await shot(page, "01-case-home-fresh");
});

test("1b prepare: agent task -> checklist with citations; sandbox vs cloud", async () => {
  await page.goto("/app/prepare");
  await expect(page.getByRole("heading", { name: "Prepare for an appointment" })).toBeVisible();
  const t0 = Date.now();
  const taskRes = page.waitForResponse((r) => /\/api\/agent\/tasks\//.test(r.url()) && r.request().method() === "GET", { timeout: 60_000 });
  await page.getByRole("button", { name: "Prepare my checklist" }).click();
  await taskRes;
  await expect(page.locator(".checklist .check-item").first()).toBeVisible({ timeout: 180_000 });
  const secs = (Date.now() - t0) / 1000;
  const items = await page.locator(".checklist .check-item").count();
  const cites = await page.locator(".checklist .cite").count();
  const chip = (await page.locator(".ran-on").first().textContent())?.trim();
  const trace = await page.locator("ol.trace li").allTextContents();
  const attribution = await page.locator("section[aria-label='Agent activity']").innerText();
  note("prepare", { secs, items, cites, chip, trace, attribution });
  expect(items).toBeGreaterThan(0);
  expect(cites).toBeGreaterThan(0);
  await page.locator(".checklist .cite").first().click();
  const href = await page.locator(".cite-open a").first().getAttribute("href");
  note("prepare-citation", { href, quote: await page.locator(".cite-open").first().innerText() });
  expect(href).toMatch(/^https?:\/\//);
  expect(await page.locator(".phrases .phrase").count()).toBeGreaterThan(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  await shot(page, "02-prepare-result");
  await page.getByRole("button", { name: "Save to case" }).click();
  await expect(page.getByText("Saved: appointment and documents added to your case.")).toBeVisible();
});

test("1c ask my agent: UI entry point + direct API", async () => {
  // The UI has no "ask my agent" control (only prepare/file call the agent). Verify the route directly with the page's cookie.
  const out = await page.evaluate(async () => {
    const c = {
      id: "case-live-test", office: "Wydział Spraw Cudzoziemców MUW - Marszałkowska",
      profile: { name: "Maya Kowalczyk-Test", language: "en" }, events: [], documents: [], deadlines: [],
    };
    const r = await fetch("/api/agent/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "Which documents do I usually need at a fingerprint appointment?", case: c, language: "en" }) });
    const j = await r.json();
    if (!r.ok) return { status: r.status, body: j };
    let last: unknown = null;
    for (let i = 0; i < 100; i++) {
      const t = await (await fetch(`/api/agent/tasks/${j.taskId}`)).json();
      last = t;
      if (t.status === "done" || t.status === "failed") break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    return { status: r.status, task: last };
  });
  note("ask", out);
  const task = (out as { task?: { status: string; ranOn?: string; sandbox?: string; result?: unknown } }).task;
  expect(task?.status).toBe("done");
  expect(JSON.stringify(task?.result ?? "").length).toBeGreaterThan(20);
});

test("1d meet: intro, two typed turns, End, wrap-up, Save to case, event on case home", async () => {
  await page.goto("/app/meet");
  await expect(page.locator(".intro-pl")).toBeVisible({ timeout: 60_000 });
  note("intro", { pl: await page.locator(".intro-pl").innerText() });
  await shot(page, "03-meet-intro");
  await page.getByRole("button", { name: "Start interpreting" }).click();
  await expect(page.getByText("No audio is stored").first()).toBeVisible();

  const official = page.locator(".half-official");
  await official.getByRole("button", { name: "Wpisz" }).click();
  await official.getByPlaceholder("Proszę wpisać po polsku").fill("Proszę przynieść paszport i umowę najmu do piątku.");
  await official.getByRole("button", { name: "Tłumacz" }).click();
  await expect(page.locator(".half-user .turn-trans").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".half-user .turn-trans").first()).not.toContainText("Interpreting");
  const t1 = await page.locator(".half-user .turn-trans").first().innerText();

  const user = page.locator(".half-user");
  await user.getByRole("button", { name: "Type" }).click();
  await user.getByPlaceholder("Type what you want to say").fill("Can I bring the lease next week?");
  await user.getByRole("button", { name: "Interpret" }).click();
  await expect(page.locator(".half-official .turn-trans").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".half-official .turn-trans").first()).not.toContainText("Tłumaczę");
  const t2 = await page.locator(".half-official .turn-trans").first().innerText();
  note("turns", { officialToUser: t1, userToOfficial: t2, micLabel: await page.locator(".talk").first().innerText() });
  expect(t2.length).toBeGreaterThan(5);
  await shot(page, "04-meet-turns");

  await page.getByRole("button", { name: "End" }).click();
  await expect(page.getByRole("heading", { name: "What was agreed" })).toBeVisible({ timeout: 90_000 });
  note("wrap", { text: await page.locator(".page").innerText() });
  await shot(page, "05-wrap");
  await page.getByRole("button", { name: "Save to case" }).click();
  await expect(page.getByText("Saved to your case.")).toBeVisible();
  // The agent filing of the wrap-up (file task) reports where it ran.
  await expect(page.locator(".save-bar")).toContainText(/Filed by|did not confirm|Saved on this device/, { timeout: 120_000 });
  note("filing", { label: await page.locator(".save-bar p.small").first().innerText() });
  await page.getByRole("link", { name: "Back to case" }).click();
  await expect(page.locator("ol.timeline li.tl-wrap").first()).toBeVisible();
  await expect(page.locator("ol.timeline")).toContainText("Appointment at");
  await shot(page, "06-case-after-meet");
});

test("2a letters: PNG as own user = free first letter -> read, link, deadline 10 Nov 2026", async () => {
  await page.goto("/app/letters");
  await expect(page.getByRole("heading", { name: "Read an official letter" })).toBeVisible();
  await page.locator('input[aria-label="Letter PDF or image"]').setInputFiles(SAMPLE_PNG);
  await expect(page.getByLabel("Polish text, exactly as printed")).toBeVisible({ timeout: 120_000 });
  const pl = await page.locator(".transcript-text").innerText();
  const asks = await page.locator("ol.asks li").count();
  note("letter-read", { transcriptHead: pl.slice(0, 300), asks, chip: await page.locator(".letter-head .chip").first().innerText() });
  expect(pl.length).toBeGreaterThan(40);
  expect(asks).toBeGreaterThan(0);
  await shot(page, "07-letter-read");
  await page.locator("#delivery-date").click();
  await page.locator(`.ui-day[data-iso="2026-10-27"]`).click();
  await page.getByRole("button", { name: /Link to my case/ }).click();
  await expect(page.getByText("How we counted it", { exact: false })).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".deadline-hero .dl-date")).toContainText("10 Nov 2026");
  note("letter-link", { steps: await page.locator("ol.calc-steps li").allTextContents(), explanation: await page.locator(".link-card p").first().innerText() });
  await shot(page, "08-letter-linked");
  await page.getByRole("button", { name: "Add to case and set a reminder" }).click();
  await expect(page.getByText("Added to your case", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Back to case" }).click();
  await expect(page.getByText("The deadline that matters")).toBeVisible();
  await expect(page.locator(".deadline-hero .dl-date")).toContainText("10 Nov 2026");
});

test("4 privacy ledger: model rows, egress row with domain, chain verified", async () => {
  await page.goto("/app/privacy");
  await expect(page.getByRole("heading", { name: "Privacy ledger" })).toBeVisible();
  await expect(page.locator("ol.ledger li").first()).toBeVisible({ timeout: 30_000 });
  const verified = await page.getByText("chain verified").count();
  const led = await page.evaluate(async () => (await fetch("/api/ledger?limit=200")).json());
  const entries = led.entries as { kind: string; what: string; action?: string; region?: string; seq: number; hash: string; prevHash: string }[];
  const model = entries.filter((e) => e.kind === "model");
  const egress = entries.filter((e) => e.kind === "egress");
  note("ledger", {
    verified: led.verified, root: led.root, total: entries.length, model: model.length, egress: egress.length,
    modelSample: model.slice(0, 12).map((e) => e.what), egressSample: egress.slice(0, 10).map((e) => ({ what: e.what, action: e.action })),
    kinds: Object.fromEntries([...new Set(entries.map((e) => e.kind))].map((k) => [k, entries.filter((e) => e.kind === k).length])),
  });
  expect(verified).toBeGreaterThan(0);
  expect(led.verified).toBe(true);
  expect(model.length).toBeGreaterThan(0);
  expect(egress.length, "at least one egress row (needs agent run in a sandbox; cloud fallback produces none)").toBeGreaterThan(0);
  expect(egress.some((e) => /[a-z0-9-]+\.[a-z]{2,}/i.test(e.what) && (e.action === "allowed" || e.action === "denied"))).toBe(true);
  await page.getByRole("button", { name: /Agent network/ }).click();
  await shot(page, "10-privacy-ledger");
});
