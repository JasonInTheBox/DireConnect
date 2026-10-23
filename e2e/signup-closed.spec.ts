import { expect, test } from "@playwright/test";
import { mockApi } from "./helpers/app";

const NOTICE =
  "DireConnect is a non-commercial project, so new accounts aren’t being created right now. If you already have an account, you can log in.";

test("signup says sign-up is closed instead of showing the form", async ({ page }) => {
  const state = await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Sign-up is closed" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(NOTICE);
  await expect(page.getByRole("link", { name: "Go to log in" })).toHaveAttribute("href", "/login");
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page).toHaveTitle("Sign-up is closed · DireConnect");
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/signup")).toHaveLength(0);
});

test("the landing page shows the notice and drops the sign up link", async ({ page }) => {
  await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/");

  await expect(page.getByRole("note")).toContainText(NOTICE);
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
});

test("the login footer says no accounts are being created", async ({ page }) => {
  await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/login");

  await expect(page.getByText("New accounts aren’t being created right now.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
});

test("with sign-ups open the form and both links stay", async ({ page }) => {
  await mockApi(page, { businesses: [] });

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("a refused sign-up shows the notice even when the settings request fails", async ({ page }) => {
  const state = await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.route("https://example.supabase.co/auth/v1/settings", (route) => route.abort());
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Sign-up is closed" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(NOTICE);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByText("Signups not allowed")).toHaveCount(0);
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/signup")).toHaveLength(1);
});
