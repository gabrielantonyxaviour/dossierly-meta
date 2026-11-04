// Usage: node scripts/samples/generate.mjs   (renders public/sample/{letters,photos,screens})
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { LETTERS } from "./letters-html.mjs";
import { SCREENS } from "./screens-html.mjs";
import { photoHtml } from "./photo-html.mjs";

const out = new URL("../../public/sample/", import.meta.url).pathname;
for (const d of ["letters", "photos", "screens"]) mkdirSync(out + d, { recursive: true });
const browser = await chromium.launch();
const shot = async (html, w, h, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const r = { page, ctx };
  return r;
};
for (const [id, html] of Object.entries(LETTERS)) {
  const { page, ctx } = await shot(html, 1240, 1754);
  await page.screenshot({ path: `${out}letters/${id}.png` });
  await page.pdf({ path: `${out}letters/${id}.pdf`, width: "1240px", height: "1754px", printBackground: true });
  await ctx.close();
}
for (const [id, html] of Object.entries(SCREENS)) {
  const { page, ctx } = await shot(html, 1440, 900);
  await page.screenshot({ path: `${out}screens/${id}.png` });
  await ctx.close();
}
for (const id of ["wezwanie-braki", "wezwanie-odciski"]) {
  const { page, ctx } = await shot(photoHtml(`data:image/png;base64,${readFileSync(`${out}letters/${id}.png`).toString("base64")}`, id === "wezwanie-braki" ? 1 : -1), 1200, 1600);
  await page.waitForTimeout(300);
  let q = 80, buf;
  do { buf = await page.screenshot({ type: "jpeg", quality: q }); q -= 6; } while (buf.length > 600_000 && q > 30);
  writeFileSync(`${out}photos/${id}-phone.jpg`, buf);
  console.log(id, buf.length);
  await ctx.close();
}
await browser.close();
