import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./helpers/app";

const NOTICE =
  "DireConnect is a non-commercial project, so accounts are opened by invitation while it is being tested. Write to junjie.6liu@gmail.com to ask for one, or log in if you already have an account.";

/** The placeholder line; other `role="status"` regions (the toast area) exist on every page. */
function checkingStatus(page: Page) {
  return page.getByRole("status").filter({ hasText: "Checking whether sign-up is open…" });
}

const SETTINGS_URL = "https://example.supabase.co/auth/v1/settings";

/** Holds the settings answer until `release()` is called, so the "checking" state can be inspected. */
async function holdSettings(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Registered after mockApi, so it runs first and hands the request on once released.
  await page.route(SETTINGS_URL, async (route) => {
    await gate;
    await route.fallback();
  });
  return release;
}

test("signup says sign-up is closed instead of showing the form", async ({ page }) => {
  const state = await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Accounts are by invitation" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(NOTICE);
  await expect(page.getByRole("link", { name: "Go to log in" })).toHaveAttribute("href", "/login");
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page).toHaveTitle("Accounts are by invitation · DireConnect");
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/signup")).toHaveLength(0);
});

test("the landing page asks for an invite and drops the sign up link", async ({ page }) => {
  await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/");

  await expect(page.getByText("Accounts are by invitation and free while DireConnect is being tested.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for an invite" }).first()).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
});

test("the login footer offers an invite instead of sign up", async ({ page }) => {
  await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.goto("/login");

  await expect(page.getByRole("link", { name: "Ask for an invite" })).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
});

test("with sign-ups open the form and both links stay", async ({ page }) => {
  await mockApi(page, { businesses: [] });

  const signupSettings = page.waitForResponse(/auth\/v1\/settings/);
  await page.goto("/signup");
  await signupSettings;
  await expect(page.getByText("Checking whether sign-up is open…")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);

  const landingSettings = page.waitForResponse(/auth\/v1\/settings/);
  await page.goto("/");
  await landingSettings;
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);

  const loginSettings = page.waitForResponse(/auth\/v1\/settings/);
  await page.goto("/login");
  await loginSettings;
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("while the settings answer is pending, sign-up shows a placeholder and no form", async ({ page }) => {
  await mockApi(page, { businesses: [] });
  const release = await holdSettings(page);
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(checkingStatus(page)).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create account" })).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveCount(0);

  release();

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(checkingStatus(page)).toHaveCount(0);
});

test("while the settings answer is pending and sign-ups are closed, the form never appears", async ({ page }) => {
  await mockApi(page, { businesses: [], signupsDisabled: true });
  const release = await holdSettings(page);
  await page.goto("/signup");

  await expect(checkingStatus(page)).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);

  release();

  await expect(page.getByRole("heading", { name: "Accounts are by invitation" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  // Plain "closed" on first load does not steal focus.
  await expect(page.getByRole("note")).not.toBeFocused();
});

test("while the settings answer is pending, the landing page and login footer offer no sign-up link", async ({ page }) => {
  await mockApi(page, { businesses: [] });
  const release = await holdSettings(page);

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
  await expect(page.getByRole("note")).toHaveCount(0);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByText("Don’t have an account?")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ask for an invite" })).toHaveCount(0);

  release();

  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
});

test("a refused sign-up shows the notice even when the settings request fails", async ({ page }) => {
  const state = await mockApi(page, { businesses: [], signupsDisabled: true });
  await page.route("https://example.supabase.co/auth/v1/settings", (route) => route.abort());
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Accounts are by invitation" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText(NOTICE);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByText("Signups not allowed")).toHaveCount(0);
  // The form the visitor just used is gone, so focus moves to the notice.
  await expect(page.getByRole("note")).toBeFocused();
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/signup")).toHaveLength(1);
});
