import path from "node:path";

import { expect, test } from "@playwright/test";

test("Android local mode stores a trip and photos on the device", async ({ page }) => {
  await page.addInitScript(() => {
    // Make Capacitor report Android without a native bridge.
    (window as unknown as { androidBridge: unknown }).androidBridge = {};
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /本地旅行者/ })).toBeVisible();
  await page.getByRole("button", { name: "创建你的第一次旅行" }).click();
  await page.getByLabel("标题", { exact: true }).fill("离线旅行");
  await page.getByLabel("开始日期").fill("2026-10-01");
  await page.getByLabel("结束日期").fill("2026-10-03");
  await page.getByRole("button", { name: "创建旅行" }).click();

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "离线旅行" })).toBeVisible();

  await page.getByRole("button", { name: "添加照片" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "e2e", "fixtures", "sample.jpg"));
  await page.getByRole("button", { name: /导入 1 张照片/ }).click();
  await expect(page.getByText(/照片已导入/).first()).toBeVisible({ timeout: 45_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "离线旅行" })).toBeVisible();
  await expect(page.locator('img[src^="blob:"]').first()).toBeVisible();
});
