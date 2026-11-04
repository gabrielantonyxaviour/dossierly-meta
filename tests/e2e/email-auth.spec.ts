import { expect, test, type Page } from "@playwright/test";

const account = {
  accountId: "email-qa-isolated", accountKind: "email", activeCase: "own",
  plan: { kind: "free", creditsLeft: 0 }, planChosen: true, lettersUsed: 0, freeLetters: 3,
};
const challenge = { challengeId: "email-challenge-qa", expiresIn: 600, resendAfter: 60 };
const address = "ananya.rao@example.com";

async function mockApi(page: Page) {
  let signedIn = false;
  const calls: { path: string; body: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    calls.push({ path, body });
    if (path === "/api/me") return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn ? account : { error: "Sign in", code: "no_session" } });
    if (path === "/api/status") return route.fulfill({ json: { models: [], bridge: { online: false, lastSeen: null, sandboxes: 0 } } });
    if (path === "/api/auth/email/request") return route.fulfill({ json: challenge });
    if (path === "/api/auth/email/verify") { signedIn = true; return route.fulfill({ json: account }); }
    if (path === "/api/session") return route.fulfill({ json: { ...account, activeCase: "sample" } });
    return route.fulfill({ status: 503, json: { error: "Unexpected API blocked by UI test" } });
  });
  return calls;
}

async function requestCode(page: Page, path = "/signin") {
  await page.goto(path);
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Six-digit code")).toBeVisible();
}

for (const width of [390, 820, 1440]) {
  test(`email and code forms fit ${width}px, including errors and long addresses`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockApi(page);
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByRole("button", { name: /passkey|device only/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator(".auth-email-form").getByRole("alert")).toHaveText("Enter a valid email address.");
    const email = `ananya.${"r".repeat(48)}@${"d".repeat(54)}.example.com`;
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Six-digit code")).toBeFocused();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByLabel("Six-digit code")).toHaveAttribute("autocomplete", "one-time-code");
    await expect(page.locator('[data-slot="input-otp-slot"]')).toHaveCount(6);
    const slots = await page.locator('[data-slot="input-otp-slot"]').evaluateAll((els) => els.map((el) => {
      const { width, height } = el.getBoundingClientRect(); return { width, height };
    }));
    for (const slot of slots) {
      expect(slot.width).toBeGreaterThanOrEqual(36);
      expect(slot.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.locator(".auth-email-form").getByRole("alert")).toHaveText("Enter the six-digit code from your email.");
    const geometry = await page.locator(".auth-card").evaluate((card) => {
      const controls = [...card.querySelectorAll("input, button")].map((el) => {
        const box = el.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width, height: box.height };
      });
      return { overflow: document.documentElement.scrollWidth > innerWidth, controls };
    });
    expect(geometry.overflow).toBe(false);
    for (const box of geometry.controls) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.width).toBeGreaterThan(70);
      expect(box.height).toBeGreaterThanOrEqual(32);
    }
    await page.getByRole("button", { name: "Change email" }).click();
    await expect(page.getByLabel("Email address")).toBeFocused();
    await expect(page.getByLabel("Email address")).toHaveValue(email);
  });
}

test("validates, accepts pasted OTP, and preserves the safe next destination", async ({ page }) => {
  const calls = await mockApi(page);
  await requestCode(page, "/signin?next=%2Fapp%2Fhelp");
  expect(calls.find((call) => call.path.endsWith("/request"))?.body).toEqual({ email: address });
  await page.getByLabel("Six-digit code").fill("12");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  expect(calls.filter((call) => call.path.endsWith("/verify"))).toHaveLength(0);
  await page.getByLabel("Six-digit code").evaluate((input) => {
    const data = new DataTransfer(); data.setData("text", "123 456");
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.getByLabel("Six-digit code")).toHaveValue("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/app\/help$/);
  expect(calls.find((call) => call.path.endsWith("/verify"))?.body).toEqual({ challengeId: challenge.challengeId, code: "123456" });
});

test("resend cooldown, new challenge, change email and local expiry", async ({ page }) => {
  const calls = await mockApi(page);
  await page.clock.install();
  await requestCode(page);
  await expect(page.getByRole("button", { name: /Resend code in/ })).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.route("**/api/auth/email/request", (route) => route.fulfill({ json: { ...challenge, challengeId: "replacement-code" } }));
  await page.getByRole("button", { name: "Resend code", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Use the code from the latest email");
  await page.getByLabel("Six-digit code").fill("654321");
  await page.clock.fastForward(601_000);
  await expect(page.getByRole("button", { name: "Verify and continue" })).toBeDisabled();
  await expect(page.getByText("This code has expired. Request a new one below.")).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith("/verify"))).toHaveLength(0);
  await page.getByRole("button", { name: "Resend code", exact: true }).click();
  await expect(page.getByLabel("Six-digit code")).toHaveValue("");
  await page.getByLabel("Six-digit code").fill("654321");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(calls.find((call) => call.path.endsWith("/verify"))?.body).toEqual({ challengeId: "replacement-code", code: "654321" });
});

for (const [code, message] of [
  ["invalid_code", "That code didn’t match"], ["expired_code", "That code has expired"],
  ["too_many_attempts", "Too many attempts"], ["rate_limited", "Too many requests"],
  ["email_unavailable", "We can’t complete email sign-in right now"],
]) {
  test(`handles verification ${code} without exposing provider details`, async ({ page }) => {
    await mockApi(page);
    await page.route("**/api/auth/email/verify", (route) => route.fulfill({ status: ["too_many_attempts", "rate_limited"].includes(code) ? 429 : 400, json: { code, error: "private provider details" } }));
    await requestCode(page);
    await page.getByLabel("Six-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText(message);
    await expect(page.getByText("private provider details")).toHaveCount(0);
    if (["expired_code", "too_many_attempts"].includes(code)) {
      await expect(page.getByRole("button", { name: "Verify and continue" })).toBeDisabled();
    }
  });
}

test("request loading prevents duplicates; outage and offline errors can be retried", async ({ page }) => {
  await mockApi(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/auth/email/request", async (route) => {
    await gate;
    await route.fulfill({ status: 503, body: "Provider internal failure" });
  });
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sending your code…" })).toBeDisabled();
  release();
  await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText("We can’t complete email sign-in right now");
  await page.route("**/api/auth/email/request", (route) => route.abort());
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".auth-email-form").getByRole("alert")).toContainText("You seem to be offline");
});

for (const [query, destination] of [
  ["start=sample", /\/app\?start=sample$/],
  ["next=https%3A%2F%2Fexample.com", /\/app$/],
]) {
  test(`signup retains routing: ${query}`, async ({ page }) => {
    await mockApi(page);
    await requestCode(page, `/signup?${query}`);
    await page.getByLabel("Six-digit code").fill("123456");
    await page.getByRole("button", { name: "Verify and continue" }).click();
    await expect(page).toHaveURL(destination);
  });
}

test("existing email sessions skip sign-in; earlier accounts can verify email", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/me", (route) => route.fulfill({ json: { ...account, accountKind: "device" } }));
  await page.goto("/signin");
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.route("**/api/me", (route) => route.fulfill({ json: account }));
  await page.reload();
  await expect(page).toHaveURL(/\/app$/);
});


test("digit slots support leading zeros, keyboard editing and rejecting letters", async ({ page }) => {
  await mockApi(page);
  await requestCode(page);
  const code = page.getByLabel("Six-digit code");
  await code.pressSequentially("012345");
  await expect(code).toHaveValue("012345");
  await expect(page.locator('[data-slot="input-otp-slot"]').first()).toHaveText("0");
  await expect(page.locator('[data-slot="input-otp-slot"]').nth(5)).toHaveAttribute("data-active", "true");
  await code.press("ArrowLeft");
  await expect(page.locator('[data-slot="input-otp-slot"]').nth(4)).toHaveAttribute("data-active", "true");
  await code.press("Backspace");
  await expect(code).toHaveValue("01235");
  await code.pressSequentially("a");
  await expect(code).toHaveValue("01235");
  await code.fill("");
  await expect(page.locator('[data-slot="input-otp-slot"]').first()).toHaveAttribute("data-active", "true");
});

test("full-code paste replaces partial input, retains focus and respects expiry", async ({ page }) => {
  await mockApi(page);
  await page.clock.install();
  await requestCode(page);
  const code = page.getByLabel("Six-digit code");
  const paste = (value: string) => code.evaluate((input, text) => {
    const data = new DataTransfer(); data.setData("text", text);
    input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, value);
  for (const [pasted, expected] of [["123 456", "123456"], ["012-345", "012345"]]) {
    await code.fill("12");
    await paste(pasted);
    await expect(code).toHaveValue(expected);
    await expect(code).toBeFocused();
  }
  await expect(page.locator('[data-slot="input-otp-slot"]').first()).toHaveText("0");
  await code.fill("12");
  await paste("34");
  await expect(code).toHaveValue("1234");
  await paste("a12345");
  await expect(code).toHaveValue("1234");
  await page.clock.fastForward(601_000);
  await expect(code).toBeDisabled();
  await paste("654321");
  await expect(code).toHaveValue("1234");
});
