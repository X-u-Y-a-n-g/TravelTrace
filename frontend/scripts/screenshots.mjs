/**
 * Capture README screenshots from a running TravelTrace instance.
 *
 *   E2E_CHANNEL=chrome node scripts/screenshots.mjs
 *
 * Requires the demo data: python demo/seed.py
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const output = path.resolve(process.cwd(), "..", "docs", "screenshots");
fs.mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  colorScheme: "light",
});
const page = await context.newPage();

async function settle(milliseconds = 1800) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(milliseconds);
}

async function shot(name) {
  await page.screenshot({ path: path.join(output, name), animations: "disabled" });
  console.log("captured", name);
}

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("01-login.png");

await page.getByLabel("Username or email").fill("demo");
await page.getByLabel("Password", { exact: true }).fill("traveltrace-demo");
await page.locator('form button[type="submit"]').click();
await page.waitForURL(`${base}/`, { timeout: 20_000 }).catch(() => undefined);
await page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Still up/ }).waitFor();
await settle(5200);
await shot("02-dashboard.png");

await page.goto(`${base}/trips`, { waitUntil: "networkidle" });
await settle(1400);
await shot("03-trips.png");

const firstTrip = page.locator('a[href^="/trips/"]').first();
await Promise.all([page.waitForURL(/\/trips\/[0-9a-f-]+/), firstTrip.click()]);
await settle(2600);
await shot("04-trip-detail.png");

await page.getByRole("tab", { name: /Timeline/ }).click();
await settle(1200);
await shot("05-timeline.png");

await page.goto(`${base}/map`, { waitUntil: "networkidle" });
await settle(2800);
await shot("06-map.png");

await page.goto(`${base}/photos`, { waitUntil: "networkidle" });
await settle(1800);
await shot("07-photos.png");

await page.goto(`${base}/settings`, { waitUntil: "networkidle" });
await settle(1000);
await shot("08-settings.png");

await page.setViewportSize({ width: 414, height: 896 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await settle(2400);
await shot("09-mobile-dashboard.png");

await browser.close();
console.log(`Screenshots written to ${output}`);
