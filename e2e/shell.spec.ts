import { expect, test } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const florist = business("b2", "Fern Florist");

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/businesses");
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the sidebar shows the workspace and the selected business", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/customers");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Businesses", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Customers", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("button", { name: /Managing Corner Bakery/ })).toBeVisible();
    await expect(page.getByText("owner@example.com")).toBeVisible();
  });

  test("switching business with the keyboard keeps the current section", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("button", { name: /Managing Corner Bakery/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio", { name: "Corner Bakery" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Fern Florist" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/businesses\/b2\/customers$/);
    await expect(page.getByRole("button", { name: /Managing Fern Florist/ })).toBeVisible();
  });

  test("Escape closes the business menu and returns focus to its button", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/dashboard");

    const trigger = page.getByRole("button", { name: /Managing Corner Bakery/ });
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("an unknown business shows a not-found message", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/nope/dashboard");

    await expect(page.getByRole("heading", { name: "Business not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to businesses" }).click();
    await expect(page).toHaveURL(/\/businesses$/);
  });

  test("a new account is invited to create its first business", async ({ page }) => {
    await mockApi(page, { businesses: [] });
    await page.goto("/businesses");

    await expect(page.getByRole("button", { name: /Create your first business/ })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Businesses", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("creating a business validates, saves and opens its dashboard", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("button", { name: /Managing Corner Bakery/ }).click();
    await page.getByRole("menuitem", { name: "Create business" }).click();

    const dialog = page.getByRole("dialog", { name: "Create a business" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create business" }).click();
    await expect(dialog.getByText("Enter a business name.")).toBeVisible();
    await expect(dialog.getByLabel("Business name")).toBeFocused();

    await dialog.getByLabel("Business name").fill("Night Market");
    await dialog.getByLabel("Email").fill("bad");
    await dialog.getByRole("button", { name: "Create business" }).click();
    await expect(dialog.getByText("Invalid email")).toBeVisible();

    await dialog.getByLabel("Email").fill("");
    await dialog.getByRole("button", { name: "Create business" }).click();

    await expect(page).toHaveURL(/\/businesses\/new-1\/dashboard$/);
    await expect(page.getByText("Business created")).toBeVisible();
    await expect(page.getByRole("button", { name: /Managing Night Market/ })).toBeVisible();
  });

  test("a slow API shows the waking-up notice instead of an error", async ({ page }) => {
    // The notice appears after 4s and the response arrives at 6s, leaving a 2s window.
    await mockApi(page, { businesses: [bakery], delayMs: 6_000 });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByText(/Waking up the server/)).toBeVisible();
    await expect(page.getByText(/Couldn.t load your businesses/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Managing Corner Bakery/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the sidebar can be collapsed and remembers the choice", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("navigation opens in a drawer that closes with Escape", async ({ page }) => {
    await signIn(page);
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

    const opener = page.getByRole("button", { name: "Open navigation" });
    await opener.click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByRole("link", { name: "Customers", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
