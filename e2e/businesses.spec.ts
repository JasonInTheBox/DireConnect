import { expect, test } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = {
  ...business("b1", "Corner Bakery"),
  description: "Fresh bread every morning.",
  email: "hello@bakery.test",
};
const florist = business("b2", "Fern Florist");

test.describe("businesses page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("lists each business with its details and an Open link", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await expect(page.getByRole("heading", { level: 1, name: "Businesses" })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: "Corner Bakery" });
    await expect(card.getByText("Fresh bread every morning.")).toBeVisible();
    await expect(card.getByText("hello@bakery.test")).toBeVisible();

    await card.getByRole("link", { name: "Open Corner Bakery" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/dashboard$/);
  });

  test("an empty account is invited to create its first business", async ({ page }) => {
    await mockApi(page, { businesses: [] });
    await page.goto("/businesses");

    await expect(page.getByRole("heading", { name: "Create your first business" })).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Create business" }).click();
    await expect(page.getByRole("dialog", { name: "Create a business" })).toBeVisible();
  });

  test("New business focuses the name field, creates the business and opens its dashboard", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "New business" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a business" });
    await expect(dialog.getByLabel("Business name")).toBeFocused();

    await dialog.getByLabel("Business name").fill("Night Market");
    await dialog.getByRole("button", { name: "Create business" }).click();

    await expect(page).toHaveURL(/\/businesses\/new-1\/dashboard$/);
    await expect(page.getByText("Business created")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business not found" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Managing Night Market/ })).toBeVisible();
  });

  test("edits a business and shows the new name", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Corner Bakery" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit business" });
    await expect(dialog.getByLabel("Business name")).toHaveValue("Corner Bakery");
    await dialog.getByLabel("Business name").fill("Corner Bakery & Cafe");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Business updated")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corner Bakery & Cafe" })).toBeVisible();
    expect(
      api.requests.some((request) => request.method === "PUT" && request.path === "/api/businesses/b1"),
    ).toBe(true);
  });

  test("deleting a business requires typing its name", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Fern Florist" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Fern Florist?" });
    const confirm = dialog.getByRole("button", { name: "Delete business" });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Type .Fern Florist. to confirm/).fill("Fern Florist");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText("Business deleted")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fern Florist" })).toHaveCount(0);
    expect(api.businesses.map((candidate) => candidate.id)).toEqual(["b1"]);
  });

  test("a delete in progress cannot be dismissed", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist], delayWritesMs: 1_500 });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Fern Florist" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Fern Florist?" });
    await dialog.getByLabel(/Type .Fern Florist. to confirm/).fill("Fern Florist");
    await dialog.getByRole("button", { name: "Delete business" }).click();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await expect(page.getByText("Business deleted")).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("a failed delete keeps the dialog open with the error, and a retry succeeds", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist], failFirstDelete: true });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Fern Florist" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Fern Florist?" });
    const confirm = dialog.getByRole("button", { name: "Delete business" });
    await dialog.getByLabel(/Type .Fern Florist. to confirm/).fill("Fern Florist");
    await confirm.click();

    await expect(dialog.getByText("Could not delete right now")).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.getByText("Business deleted")).toHaveCount(0);
    await expect(confirm).toBeEnabled();

    await confirm.click();
    await expect(page.getByText("Business deleted")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Fern Florist" })).toHaveCount(0);
  });
});
