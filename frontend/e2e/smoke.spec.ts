import path from "node:path";

import { expect, test } from "@playwright/test";

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test("register, create a trip, import a photo and open the timeline", async ({ page }) => {
  const suffix = uniqueSuffix();
  const username = `e2e${suffix}`;

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Sign in to your journal|Create your account/ })).toBeVisible();

  const createTab = page.getByRole("button", { name: "Create account" });
  if (await createTab.isVisible()) {
    await createTab.click();
  }
  await page.getByLabel("Name", { exact: true }).fill("E2E Traveller");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("supersecret123");
  await page.getByRole("button", { name: /Begin your journal/ }).click();

  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)|Still up/ })).toBeVisible();

  await page.getByRole("button", { name: "New trip" }).first().click();
  await page.getByLabel("Title", { exact: true }).fill(`E2E Kyoto ${suffix}`);
  await page.getByLabel("Start date").fill("2026-10-01");
  await page.getByLabel("End date").fill("2026-10-05");
  await page.getByLabel("Description", { exact: true }).fill("A test journey through temples and side streets.");
  await page.getByRole("button", { name: "Create trip" }).click();

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: `E2E Kyoto ${suffix}` })).toBeVisible();

  await page.getByRole("button", { name: "Add photos" }).click();
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(process.cwd(), "e2e", "fixtures", "sample.jpg"));
  await page.getByRole("button", { name: /Import 1 photo/ }).click();

  await expect(page.getByText(/Imported 1 photo/).first()).toBeVisible({ timeout: 45_000 });

  await page.getByRole("tab", { name: "Photos" }).click();
  await expect(page.locator('img[src*="/photos/"]').first()).toBeVisible();

  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Generate drafts" }).click();
  await expect(
    page.getByText(/draft events? created|No photos to organise yet/),
  ).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByRole("heading", { name: `E2E Kyoto ${suffix}` })).toBeVisible();
});

test("login page renders the product story", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Your journey,")).toBeVisible();
  await expect(page.getByText("Map-centric")).toBeVisible();
  await expect(page.getByText("Local-first")).toBeVisible();
});
