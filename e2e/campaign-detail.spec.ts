import { expect, test } from "@playwright/test";
import { business, campaign, customer, log, mockApi, signIn } from "./helpers/app";

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
const queued = campaign("k-3", "Weekend offer", { status: "QUEUED" });
const failedCampaign = campaign("k-5", "Autumn tasting", { status: "FAILED" });

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

  test("sent, queued and failed campaigns offer no actions, and an SMS draft offers only Delete", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent, queued, failedCampaign, legacySms] },
    });

    for (const [id, title] of [
      ["k-4", "Loyalty thanks"],
      ["k-3", "Weekend offer"],
      ["k-5", "Autumn tasting"],
    ]) {
      await page.goto(`/businesses/b1/campaigns/${id}/analytics`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    }

    // The send route refuses a campaign that has already been queued.
    await page.goto("/businesses/b1/campaigns/k-3/send");
    await expect(page.getByRole("heading", { name: "This campaign can’t be edited" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);

    await page.goto("/businesses/b1/campaigns/k-6/preview");
    await expect(page.getByText("SMS sending is paused")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  });

  test("landing on the send route never sends; Send now only opens the confirm dialog", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      campaigns: { b1: [draft] },
    });
    await page.goto("/businesses/b1/campaigns/k-1/send");

    const sendNow = page.getByRole("button", { name: "Send now" });
    await expect(sendNow).toBeEnabled();
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);

    await sendNow.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);
  });
});

test.describe("campaign detail: Audience and Results", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the Audience tab lists who will receive a draft and who is skipped, in plain words", async ({
    page,
  }) => {
    const mixed = [
      ...people,
      customer("c-3", "Alan", { email: "alan@bletchley.test", unsubscribedAt: "2026-09-01T00:00:00Z" }),
      customer("c-4", "Dee", { emailOptIn: true }),
    ];
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: mixed },
      campaigns: { b1: [draft] },
    });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByText("This is who would receive the campaign right now.")).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary", exact: true });
    await expect(summary).toContainText("Customers checked4");
    await expect(summary).toContainText("Will receive it2");
    await expect(summary).toContainText("Skipped2");

    const reasons = page.getByRole("region", { name: "Why customers were skipped" });
    await expect(reasons).toContainText("Hasn’t agreed to receive emails1");
    await expect(reasons).toContainText("No email address1");

    const recipients = page.getByRole("region", { name: "Recipients", exact: true });
    await expect(recipients).toContainText("ada@example.com");
    await expect(recipients).toContainText("grace@navy.test");
    await expect(page.getByRole("region", { name: "Skipped customers" })).toContainText(
      "Hasn’t agreed to receive emails",
    );

    // Viewing a draft never queues it.
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);
    await expect(page.getByRole("button", { name: /Queue/ })).toHaveCount(0);
  });

  test("the Audience tab explains a saved recipient list for a sent campaign", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people }, campaigns: { b1: [sent] } });
    await page.goto("/businesses/b1/campaigns/k-4/preview");

    await expect(page.getByText("fixed when the campaign was queued")).toBeVisible();
  });

  test("Results for a draft says there is nothing yet and offers Review and send", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/analytics");

    await expect(page.getByRole("heading", { name: "No results yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" }).last()).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/send",
    );
    expect(state.requests.some((request) => request.path.endsWith("/analytics"))).toBe(false);
  });

  test("Results shows delivery, recipients and the reasons for skips and failures", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      analytics: {
        "k-4": {
          eligibleCount: 4,
          sentCount: 2,
          failedDeliveryCount: 2,
          skippedBeforeSendCount: 1,
          skippedByReason: { "Customer has unsubscribed": 1 },
          failedByReason: { "Daily limit reached for this account": 2 },
        },
      },
    });
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    const delivery = page.getByRole("region", { name: "Delivery", exact: true });
    await expect(delivery).toContainText("Sent");
    await expect(delivery).toContainText("50% success rate");

    const recipients = page.getByRole("region", { name: "Recipients", exact: true });
    await expect(recipients).toContainText("Eligible when queued4");
    await expect(recipients).toContainText("Skipped before sending1");

    await expect(page.getByRole("region", { name: "Why customers were skipped" })).toContainText(
      "Hasn’t agreed to receive emails1",
    );
    await expect(page.getByRole("region", { name: "Why messages failed" })).toContainText(
      "Daily limit reached for this account2",
    );
    await expect(page.getByText(/Daily sending limits can mark some recipients as failed/)).toBeVisible();
  });

  test("Results for a queued campaign explains the wait, and Refresh reloads both the numbers and the status", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");

    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Queued");

    // The worker finishes while the page is open.
    state.campaigns.b1[0].status = "SENT";
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Sent");
    await expect(page.getByText(/queued and waiting to be sent/)).toHaveCount(0);
  });

  test("Results explains an older campaign without a saved recipient list, and an empty delivery", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [failedCampaign] },
      analytics: { "k-5": { analyticsSource: "LEGACY_LOGS" } },
    });
    await page.goto("/businesses/b1/campaigns/k-5/analytics");

    await expect(page.getByText(/older campaign without a saved recipient list/)).toBeVisible();
    await expect(page.getByText("No messages have gone out yet.")).toBeVisible();
    await expect(page.getByText("No messages have failed.")).toBeVisible();
    await expect(page.getByText("No customers were skipped.")).toBeVisible();
  });

  test("a failed results request offers a retry", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] }, failAnalyticsFor: ["k-4"] });
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    await expect(page.getByRole("heading", { name: "Couldn’t load the results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("campaign detail: Delivery log", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("lists every message with its status, send time and failure reason", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: {
        "k-4": [
          log("l-1", "k-4", "ada@example.com"),
          log("l-2", "k-4", "grace@navy.test", {
            status: "FAILED",
            sentAt: null,
            errorMessage: "Daily limit reached for this account",
          }),
          log("l-3", "k-4", "alan@bletchley.test", { status: "PENDING", sentAt: null }),
        ],
      },
    });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByText("3 messages, 1 failed")).toBeVisible();
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toContainText("Sent");
    const failedRow = page.getByRole("row", { name: /grace@navy.test/ });
    await expect(failedRow).toContainText("Failed");
    await expect(failedRow).toContainText("Not sent");
    await expect(failedRow).toContainText("Daily limit reached for this account");
    await expect(page.getByRole("row", { name: /alan@bletchley.test/ })).toContainText("Pending");
  });

  test("explains the sending limits that can cause a failure", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] }, logs: { "k-4": [] } });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    const limits = page.getByRole("region", { name: "Why a message can fail" });
    await expect(limits).toContainText("one campaign email every 24 hours");
    await expect(limits).toContainText("up to 25 campaign emails");
    await expect(limits).toContainText("up to 100 campaign emails");
  });

  test("shows an empty state when nothing has been delivered yet", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, logs: { "k-3": [] } });
    await page.goto("/businesses/b1/campaigns/k-3/logs");

    await expect(page.getByRole("heading", { name: "No messages yet" })).toBeVisible();
  });

  test("uses stacked cards on narrower screens", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: {
        "k-4": [
          log("l-2", "k-4", "grace@navy.test", {
            status: "FAILED",
            sentAt: null,
            errorMessage: "Daily limit reached for this account",
          }),
        ],
      },
    });
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "grace@navy.test" });
    await expect(card).toContainText("Failed");
    await expect(card).toContainText("Daily limit reached for this account");
  });

  test("a failed request offers a retry", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] } });
    await page.route("**/api/businesses/b1/campaigns/k-4/logs", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({ error: "Logs unavailable" }),
          })
        : route.fallback(),
    );
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByRole("heading", { name: "Couldn’t load the delivery log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
