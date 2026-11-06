/**
 * Capture the first-launch server setup screen in Chinese and English.
 *
 *   E2E_CHANNEL=chrome node scripts/screenshots-mobile.mjs
 *
 * `window.androidBridge` makes Capacitor report an Android platform in a normal
 * Chromium page, so the setup screen renders without an emulator.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const output = path.resolve(process.cwd(), "..", "docs", "screenshots", "mobile");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || undefined });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "light",
});
await context.addInitScript(() => {
  window.androidBridge = {};
  window.localStorage.clear();
});
const page = await context.newPage();
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

await page.screenshot({ path: path.join(output, "01-setup-zh.png"), animations: "disabled" });
await page.getByRole("button", { name: "EN" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(output, "02-setup-en.png"), animations: "disabled" });

await browser.close();
console.log(`Mobile setup screenshots written to ${output}`);
