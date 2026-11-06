import { expect, test } from "@playwright/test";

test("defaults to Chinese and remembers the language choice", async ({ page }) => {
  await page.goto("/login");

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: /你的旅程/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /登录你的旅行手账|创建你的账户/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "EN" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: /Sign in to your journal|Create your account/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Your journey/ })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Sign in to your journal|Create your account/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "中" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(
    page.getByRole("heading", { name: /登录你的旅行手账|创建你的账户/ }),
  ).toBeVisible();
});
