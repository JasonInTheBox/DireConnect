import { expect, test } from "@playwright/test";
import { business, campaign, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const draft = campaign("k-1", "Spring menu");
const scheduled = campaign("k-2", "Holiday preview", {
  status: "QUEUED",
  sendAt: "2099-12-01T12:00:00.000Z",
});
const waiting = campaign("k-3", "Weekend offer", { status: "QUEUED" });
const sent = campaign("k-4", "Loyalty thanks", {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
});
const failed = campaign("k-5", "Autumn tasting", {
  status: "FAILED",
  updatedAt: "2026-09-28T08:00:00.000Z",
});
const legacySms = campaign("k-6", "Text blast", { channel: "SMS" });

const analytics = {
  "k-2": { eligibleCount: 5 },
  "k-3": { eligibleCount: 3, pendingCount: 2, sentCount: 1 },
  "k-4": { eligibleCount: 4, sentCount: 3, failedDeliveryCount: 1 },
  "k-5": { eligibleCount: 2, failedDeliveryCount: 2 },
};

test.describe("campaign list", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("shows status, when and delivery for every campaign", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, scheduled, waiting, sent, failed, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("heading", { level: 1, name: "Campaigns" })).toBeVisible();
    const row = (name: RegExp) => page.getByRole("row", { name });

    await expect(row(/Spring menu/)).toContainText("Draft");
    await expect(row(/Spring menu/)).toContainText("Not sent yet");
    await expect(row(/Holiday preview/)).toContainText("Scheduled");
    await expect(row(/Holiday preview/)).toContainText("2099");
    await expect(row(/Weekend offer/)).toContainText("Queued");
    await expect(row(/Weekend offer/)).toContainText("Waiting to be sent");
    await expect(row(/Weekend offer/)).toContainText("1 of 3 sent, 2 pending");
    await expect(row(/Loyalty thanks/)).toContainText("Sent");
    await expect(row(/Loyalty thanks/)).toContainText("3 of 4 sent, 1 failed");
    await expect(row(/Autumn tasting/)).toContainText("Failed");
    await expect(row(/Autumn tasting/)).toContainText("0 of 2 sent, 2 failed");
    await expect(row(/Text blast/)).toContainText("SMS sending is paused");
    await expect(row(/Text blast/)).toContainText("SMS");
  });

  test("asks for delivery numbers only for campaigns that are not drafts", async ({ page }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, sent, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");
    await expect(page.getByRole("row", { name: /Loyalty thanks/ })).toContainText("3 of 4 sent");

    const analyticsPaths = state.requests
      .filter((request) => request.path.endsWith("/analytics"))
      .map((request) => request.path);
    expect(analyticsPaths).toEqual(["/api/businesses/b1/campaigns/k-4/analytics"]);
  });

  test("one failing delivery request leaves the other rows intact", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent, failed] },
      analytics,
      failAnalyticsFor: ["k-4"],
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("row", { name: /Loyalty thanks/ })).toContainText("Unavailable");
    await expect(page.getByRole("row", { name: /Autumn tasting/ })).toContainText(
      "0 of 2 sent, 2 failed",
    );
  });

  test("offers row actions only where they apply, and deletes a draft after confirming", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, sent, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("button", { name: "Actions for Loyalty thanks" })).toHaveCount(0);

    await page.getByRole("button", { name: "Actions for Text blast" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Actions for Spring menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete campaign" }).click();

    await expect(page.getByText("Campaign deleted")).toBeVisible();
    await expect(page.getByRole("row", { name: /Spring menu/ })).toHaveCount(0);
    expect(
      state.requests.some(
        (request) =>
          request.method === "DELETE" && request.path === "/api/businesses/b1/campaigns/k-1",
      ),
    ).toBe(true);
  });

  test("links each row to its detail page and offers the wizard when empty", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, sent, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");

    // Drafts open on the read-only Audience tab; sending goes through the wizard.
    await expect(page.getByRole("link", { name: "Spring menu" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/preview",
    );
    await expect(page.getByRole("link", { name: "Text blast" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-6/preview",
    );
    await expect(page.getByRole("link", { name: "Loyalty thanks" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-4/analytics",
    );
    await expect(page.getByRole("link", { name: "New campaign" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/new",
    );
  });

  test("shows an empty state with a link to create the first campaign", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [] } });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("heading", { name: "No campaigns yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your first campaign" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/new",
    );
  });

  test("uses stacked cards instead of a table on narrower screens", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] }, analytics });
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "Loyalty thanks" });
    await expect(card).toContainText("Sent");
    await expect(card).toContainText("3 of 4 sent, 1 failed");
  });
});
