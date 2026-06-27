import { expect, test } from "@playwright/test";

test("homepage loads without crashing", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBe(true);

  await expect(page.locator("body")).toBeVisible();
});

test("homepage shows auth actions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
});

test("login page shows an auth form", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: /log in/i })).toBeVisible();
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  await expect(page.getByPlaceholder("Your password")).toBeVisible();
});
