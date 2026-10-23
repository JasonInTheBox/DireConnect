import { expect, test } from "@playwright/test";

test("login explains missing fields inline and focuses the first one", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("login and signup link to each other", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("signup explains missing fields inline", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Choose a password.")).toBeVisible();
});
