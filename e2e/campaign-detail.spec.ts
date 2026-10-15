import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const people = [
  customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true }),
  customer("c-2", "Grace", { email: "grace@navy.test", emailOptIn: true }),
];

const draft = campaign("k-1", "Spring menu", { message: "Blossom buns are back." });
const sent = campaign("k-4", "Loyalty thanks", {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
});
const legacySms = campaign("k-6", "Text blast", { channel: "SMS" });

test.describe("campaign detail", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("shows the title, status, message and the three tabs", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByRole("heading", { level: 1, name: "Spring menu" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Campaign summary" });
    await expect(summary).toContainText("Draft");
    await expect(summary).toContainText("Email");
    await expect(summary).toContainText("Not scheduled");
    await expect(summary).toContainText("Blossom buns are back.");

    const tabs = page.getByRole("navigation", { name: "Campaign sections" });
    await expect(tabs.getByRole("link", { name: "Audience" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/preview",
    );
    await expect(tabs.getByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/analytics",
    );
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/logs",
    );
    await expect(tabs.getByRole("link", { name: "Audience" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Results" }).click();
    await expect(page).toHaveURL(/\/campaigns\/k-1\/analytics$/);
    await expect(tabs.getByRole("link", { name: "Results" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Spring menu" })).toBeVisible();
  });

  test("the campaign address redirects to Audience for drafts and Results for the rest", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] } });

    await page.goto("/businesses/b1/campaigns/k-1");
    await expect(page).toHaveURL(/\/campaigns\/k-1\/preview$/);

    await page.goto("/businesses/b1/campaigns/k-4");
    await expect(page).toHaveURL(/\/campaigns\/k-4\/analytics$/);
  });

  test("an unknown campaign explains itself and links back", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/nope/preview");

    await expect(page.getByRole("heading", { name: "Campaign not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to campaigns" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns",
    );
  });

  test("draft actions: Review and send opens the wizard on the Review step", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people }, campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/edit",
    );
    await page.getByRole("link", { name: "Review and send" }).click();

    await expect(page).toHaveURL(/\/campaigns\/k-1\/send$/);
    await expect(page.getByRole("heading", { level: 1, name: "Review and send" })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText("Review and send");
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeEnabled();
  });

  test("the send route refuses a campaign that is already sent", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] } });
    await page.goto("/businesses/b1/campaigns/k-4/send");

    await expect(page.getByRole("heading", { name: "This campaign can’t be edited" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
  });

  test("a draft can be deleted after confirming, and the user lands on the list", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await dialog.getByRole("button", { name: "Delete campaign" }).click();

    await expect(page.getByText("Campaign deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
    expect(
      state.requests.some(
        (request) => request.method === "DELETE" && request.path === "/api/businesses/b1/campaigns/k-1",
      ),
    ).toBe(true);
  });

  test("a sent campaign offers no actions, and an SMS draft offers only Delete", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent, legacySms] } });

    await page.goto("/businesses/b1/campaigns/k-4/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Loyalty thanks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await page.goto("/businesses/b1/campaigns/k-6/preview");
    await expect(page.getByText("SMS sending is paused")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  });
});
