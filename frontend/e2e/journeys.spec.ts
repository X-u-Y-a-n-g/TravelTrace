import path from "node:path";

import { expect, test } from "@playwright/test";

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("traveltrace-language", "en");
  });
});

test("places, manual events, photo editing and every page", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const suffix = uniqueSuffix();
  const username = `flow${suffix}`;

  await page.goto("/login");
  const createTab = page.getByRole("button", { name: "Create account" });
  if (await createTab.isVisible()) await createTab.click();
  await page.getByLabel("Name", { exact: true }).fill("Flow Tester");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email", { exact: true }).fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("supersecret123");
  await page.getByRole("button", { name: /Begin your journal/ }).click();
  await expect(page.getByRole("heading", { name: /Good|Still up/ })).toBeVisible();

  await page.getByRole("button", { name: "New trip" }).first().click();
  await page.getByLabel("Title", { exact: true }).fill(`Flow Trip ${suffix}`);
  await page.getByLabel("Start date").fill("2026-10-01");
  await page.getByLabel("End date").fill("2026-10-03");
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);

  // --- Places -------------------------------------------------------------
  await page.getByRole("tab", { name: "Places" }).click();
  await page.getByRole("button", { name: "Add place" }).click();
  await page.getByRole("button", { name: "Create the first one" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Philosopher's Path");
  await page.getByLabel("City", { exact: true }).fill("Kyoto");
  await page.getByLabel("Country", { exact: true }).fill("Japan");
  await page.getByLabel("Latitude", { exact: true }).fill("35.026");
  await page.getByLabel("Longitude", { exact: true }).fill("135.795");
  await page.getByRole("dialog").getByRole("button", { name: "Add to trip" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Philosopher's Path")).toBeVisible({ timeout: 15_000 });

  // --- Manual timeline event ---------------------------------------------
  await page.getByRole("tab", { name: "Timeline" }).click();
  await page.getByRole("button", { name: "Add event" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Golden hour walk");
  await page.getByLabel("Start", { exact: true }).fill("17:30");
  await page.getByRole("dialog").getByRole("button", { name: "Add event" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText("Golden hour walk")).toBeVisible({ timeout: 15_000 });

  // --- Upload and edit a photo -------------------------------------------
  await page.getByRole("button", { name: "Add photos" }).click();
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "e2e", "fixtures", "sample.jpg"));
  await page.getByRole("button", { name: /Import 1 photo/ }).click();
  await expect(page.getByText(/Photos imported/).first()).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15_000 });

  await page.getByRole("tab", { name: "Photos" }).click();
  const firstPhoto = page.locator('img[src*="/photos/"]').first();
  await expect(firstPhoto).toBeVisible();
  await firstPhoto.click();
  await page.getByLabel("Caption").fill("Golden light on the canal");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Photo updated")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");

  // --- Every primary page renders ----------------------------------------
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "Travel map" })).toBeVisible();

  await page.goto("/photos");
  await expect(page.getByRole("heading", { name: "Every frame, in one place" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "This instance" })).toBeVisible();

  await page.goto("/trips");
  await expect(page.getByRole("heading", { name: "My trips" })).toBeVisible();

  expect(pageErrors, `Unexpected page errors: ${pageErrors.join("; ")}`).toEqual([]);
});
