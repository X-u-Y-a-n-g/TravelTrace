/**
 * Capture README screenshots in Chinese and English from a running TravelTrace instance.
 *
 *   E2E_CHANNEL=chrome node scripts/screenshots.mjs
 *
 * Requires the demo data: python demo/seed.py
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const root = path.resolve(process.cwd(), "..", "docs", "screenshots");

const LANGUAGES = [
  {
    code: "zh",
    output: path.join(root, "zh"),
    identifierLabel: "用户名或邮箱",
    passwordLabel: "密码",
    dashboardHeading: /早上好|下午好|晚上好|还没睡/,
    timelineTab: "时间线",
  },
  {
    code: "en",
    output: path.join(root, "en"),
    identifierLabel: "Username or email",
    passwordLabel: "Password",
    dashboardHeading: /Good (morning|afternoon|evening)|Still up/,
    timelineTab: "Timeline",
  },
];

const browser = await chromium.launch({
  channel: process.env.E2E_CHANNEL || undefined,
});

async function capture(language) {
  fs.mkdirSync(language.output, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  await context.addInitScript((code) => {
    window.localStorage.setItem("traveltrace-language", code);
  }, language.code);
  const page = await context.newPage();

  async function settle(milliseconds = 1800) {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(milliseconds);
  }

  async function shot(name) {
    await page.screenshot({
      path: path.join(language.output, name),
      animations: "disabled",
    });
    console.log("captured", language.code, name);
  }

  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot("01-login.png");

  await page.getByLabel(language.identifierLabel).fill("demo");
  await page.getByLabel(language.passwordLabel, { exact: true }).fill("traveltrace-demo");
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(`${base}/`, { timeout: 20_000 }).catch(() => undefined);
  await page.getByRole("heading", { name: language.dashboardHeading }).waitFor();
  await settle(5200);
  await shot("02-dashboard.png");

  await page.goto(`${base}/trips`, { waitUntil: "networkidle" });
  await settle(1400);
  await shot("03-trips.png");

  const firstTrip = page.locator('a[href^="/trips/"]').first();
  await Promise.all([page.waitForURL(/\/trips\/[0-9a-f-]+/), firstTrip.click()]);
  await settle(2600);
  await shot("04-trip-detail.png");

  await page.getByRole("tab", { name: new RegExp(language.timelineTab) }).click();
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

  await context.close();
}

for (const language of LANGUAGES) {
  await capture(language);
}

await browser.close();
console.log(`Screenshots written under ${root}`);
