import { expect, test, type Route } from "@playwright/test";
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

  test("a failed delete shows the server message and stops offering draft actions if the campaign was queued", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();

    // The campaign is queued from somewhere else while this page is open.
    state.campaigns.b1[0].status = "QUEUED";
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await dialog.getByRole("button", { name: "Delete campaign" }).click();

    await expect(dialog).toContainText("Campaign not found. Queued or sent campaigns cannot be deleted.");
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Queued");
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
    const analytics: Record<string, { eligibleCount: number; pendingCount?: number; sentCount?: number }> = {
      "k-3": { eligibleCount: 3, pendingCount: 3 },
    };
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, analytics });
    const analyticsGets = () =>
      state.requests.filter((request) => request.method === "GET" && request.path.endsWith("/k-3/analytics"))
        .length;
    await page.goto("/businesses/b1/campaigns/k-3/analytics");

    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Queued");
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Pending3");
    expect(analyticsGets()).toBe(1);

    // The worker finishes while the page is open.
    state.campaigns.b1[0].status = "SENT";
    analytics["k-3"] = { eligibleCount: 3, sentCount: 3 };
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Sent");
    await expect(page.getByText(/queued and waiting to be sent/)).toHaveCount(0);
    // The Refresh itself, plus one more read once the status change stops the polling.
    await expect.poll(analyticsGets).toBe(3);
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).not.toContainText("Pending3");
  });

  test("Refresh says it is refreshing, keeps focus on its button and ignores clicks while busy", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] } });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      gets += 1;
      if (gets === 2) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();

    const refresh = page.getByRole("button", { name: "Refresh" });
    await refresh.click();
    await expect(page.getByText("Refreshing…")).toBeVisible();
    // Not disabled (that would drop focus); it is marked busy and further clicks are ignored.
    await expect(refresh).not.toHaveAttribute("disabled");
    await expect(refresh).toHaveAttribute("aria-disabled", "true");
    await expect(refresh).toBeFocused();
    await refresh.click({ force: true });
    await expect(page.getByText("Refreshing…")).toHaveCount(0);
    expect(
      state.requests.filter((request) => request.method === "GET" && request.path.endsWith("/k-3/analytics"))
        .length,
    ).toBe(2);
  });

  test("a failed Refresh keeps the earlier numbers, says so, and Try again recovers", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      gets += 1;
      if (gets === 2) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "Analytics unavailable" }),
        });
        return;
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    const delivery = page.getByRole("region", { name: "Delivery", exact: true });
    await expect(delivery).toContainText("Pending3");

    await page.getByRole("button", { name: "Refresh" }).click();
    const notice = page.getByRole("alert").filter({ hasText: "Couldn’t refresh. Showing the earlier numbers." });
    await expect(notice).toBeVisible();
    await expect(delivery).toContainText("Pending3");

    await notice.getByRole("button", { name: "Try again" }).click();
    await expect(notice).toHaveCount(0);
    await expect(delivery).toContainText("Pending3");
    expect(gets).toBe(3);
  });

  test("a failed campaign reload shows a notice under the header and the page stays usable", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    let lists = 0;
    await page.route("**/api/businesses/b1/campaigns", async (route) => {
      lists += 1;
      if (lists === 2) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "List unavailable" }),
        });
        return;
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();

    await page.getByRole("button", { name: "Refresh" }).click();
    const notice = page
      .getByRole("alert")
      .filter({ hasText: "Couldn’t refresh the campaign. Showing the earlier details." });
    await expect(notice).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Weekend offer" })).toBeVisible();

    await notice.getByRole("button", { name: "Try again" }).click();
    await expect(notice).toHaveCount(0);
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

test.describe("campaign detail: auto-refresh and failed campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("a queued campaign refreshes on its own, and stops once it is sent", async ({ page }) => {
    const analytics: Record<string, { eligibleCount: number; pendingCount?: number; sentCount?: number }> = {
      "k-3": { eligibleCount: 3, pendingCount: 3 },
    };
    // The clock is installed before the first load so the 15 second timer can be fast-forwarded.
    await page.clock.install();
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, analytics });
    const analyticsGets = () =>
      state.requests.filter((request) => request.method === "GET" && request.path.endsWith("/k-3/analytics"))
        .length;
    await page.goto("/businesses/b1/campaigns/k-3/analytics");

    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Pending3");
    const initial = analyticsGets();
    expect(initial).toBe(1);

    // Make the first tick observable on screen (the numbers and the header both change), so the
    // test knows it has been fully applied before it changes anything else.
    analytics["k-3"] = { eligibleCount: 3, pendingCount: 2, sentCount: 1 };
    state.campaigns.b1[0].title = "Weekend offer (tick 1)";
    await page.clock.runFor(16_000);
    await expect(page.getByRole("heading", { level: 1, name: "Weekend offer (tick 1)" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Pending2");
    expect(analyticsGets()).toBe(initial + 1);

    // The worker finishes; the next tick picks up the new status and the polling stops.
    state.campaigns.b1[0].status = "SENT";
    analytics["k-3"] = { eligibleCount: 3, sentCount: 3 };
    await page.clock.runFor(16_000);
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Sent");
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).not.toContainText(/Pending[1-9]/);

    // One request for that tick plus one more when the polling stopped (see the next test).
    await expect.poll(analyticsGets).toBe(initial + 3);
    await page.waitForTimeout(300);
    const settled = analyticsGets();
    await page.clock.runFor(60_000);
    await page.waitForTimeout(300);
    expect(analyticsGets()).toBe(settled);
  });

  test("when polling stops because the status changed, the numbers are read once more", async ({ page }) => {
    const analytics: Record<string, { eligibleCount: number; pendingCount?: number; sentCount?: number }> = {
      "k-3": { eligibleCount: 3, pendingCount: 3 },
    };
    await page.clock.install();
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, analytics });
    // The worker finishes between the tick's two reads: the campaign list already says SENT, but the
    // analytics read of that same tick still reports pending. Only the follow-up read has the final numbers.
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      gets += 1;
      if (gets === 3) {
        analytics["k-3"] = { eligibleCount: 3, sentCount: 3 };
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Pending3");

    state.campaigns.b1[0].status = "SENT";
    await page.clock.runFor(16_000);

    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Sent");
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).not.toContainText(/Pending[1-9]/);
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Sent3");
    expect(gets).toBe(3);
  });

  test("a background refresh is silent: no Refreshing status and no busy button", async ({ page }) => {
    await page.clock.install();
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      gets += 1;
      if (gets === 2) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();

    await page.evaluate(() => {
      const w = window as unknown as { __announced: boolean };
      w.__announced = false;
      const check = () => {
        if (document.body.innerText.includes("Refreshing…") || document.querySelector('[aria-busy="true"]')) {
          w.__announced = true;
        }
      };
      new MutationObserver(check).observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    });

    await page.clock.runFor(16_000);
    // The tick's request is held for 800 ms; keep watching until it has finished.
    await expect.poll(() => gets).toBe(2);
    await page.waitForTimeout(1_500);
    expect(await page.evaluate(() => (window as unknown as { __announced: boolean }).__announced)).toBe(false);
    await expect(page.getByRole("button", { name: "Refresh" })).not.toHaveAttribute("aria-disabled", "true");

    // A click is a refresh the user asked for, so that one is announced.
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByText("Refreshing…")).toBeVisible();
    await expect(page.getByText("Refreshing…")).toHaveCount(0);
  });

  test("repeated failing background refreshes keep the same notices mounted", async ({ page }) => {
    await page.clock.install();
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    const fail = (route: Route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ error: "Unavailable" }),
      });
    let analyticsGets = 0;
    let listGets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      analyticsGets += 1;
      if (analyticsGets > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return fail(route);
      }
      return route.fallback();
    });
    await page.route("**/api/businesses/b1/campaigns", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }
      listGets += 1;
      if (listGets > 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return fail(route);
      }
      return route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();

    const results = page.getByRole("alert").filter({ hasText: "Couldn’t refresh. Showing the earlier numbers." });
    const header = page.getByRole("alert").filter({ hasText: "Couldn’t refresh the campaign." });

    await page.clock.runFor(16_000);
    await expect(results).toBeVisible();
    await expect(header).toBeVisible();
    await results.evaluate((element) => element.setAttribute("data-same-element", "yes"));
    await header.evaluate((element) => element.setAttribute("data-same-element", "yes"));

    // Two more failing ticks: the notices must stay the very same elements, so a screen reader hears
    // them once, not on every attempt.
    for (const tick of [2, 3]) {
      await page.clock.runFor(16_000);
      await expect.poll(() => analyticsGets).toBe(tick + 1);
      await expect.poll(() => listGets).toBe(tick + 1);
      await page.waitForTimeout(700);
      await expect(results).toHaveAttribute("data-same-element", "yes");
      await expect(header).toHaveAttribute("data-same-element", "yes");
    }
  });

  test("a sent campaign is never refreshed on a timer", async ({ page }) => {
    await page.clock.install();
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      analytics: { "k-4": { eligibleCount: 2, sentCount: 2 } },
    });
    await page.goto("/businesses/b1/campaigns/k-4/analytics");
    await expect(page.getByRole("region", { name: "Delivery", exact: true })).toContainText("Sent");

    await page.clock.runFor(60_000);
    await page.waitForTimeout(300);
    expect(
      state.requests.filter((request) => request.method === "GET" && request.path.endsWith("/k-4/analytics"))
        .length,
    ).toBe(1);
  });

  test("a tick that arrives while a refresh is still running is skipped", async ({ page }) => {
    await page.clock.install();
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-3/analytics", async (route) => {
      gets += 1;
      if (gets === 2) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");
    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();

    await page.clock.runFor(16_000);
    await expect.poll(() => gets).toBe(2);
    // The next ticks arrive while the second request is still running; they are skipped. A
    // background refresh is silent, so the second request itself shows that the tick ran.
    await page.clock.runFor(20_000);
    await expect(page.getByText("Refreshing…")).toHaveCount(0);
    // Counted at the route, because a request that is cancelled mid-flight never reaches the mock.
    expect(gets).toBe(2);
  });

  test("Delivery log has a Refresh button; a failed refresh keeps the rows and Try again recovers", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: { "k-4": [log("l-1", "k-4", "ada@example.com")] },
    });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-4/logs", async (route) => {
      gets += 1;
      if (gets === 2) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ error: "Logs unavailable" }),
        });
        return;
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-4/logs");
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toBeVisible();

    await page.getByRole("button", { name: "Refresh" }).click();
    const notice = page.getByRole("alert").filter({ hasText: "Couldn’t refresh. Showing the earlier list." });
    await expect(notice).toBeVisible();
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toBeVisible();

    await notice.getByRole("button", { name: "Try again" }).click();
    await expect(notice).toHaveCount(0);
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toBeVisible();
    expect(gets).toBe(3);
  });

  test("Delivery log says it is refreshing while a reload runs", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: { "k-4": [log("l-1", "k-4", "ada@example.com")] },
    });
    let gets = 0;
    await page.route("**/api/businesses/b1/campaigns/k-4/logs", async (route) => {
      gets += 1;
      if (gets === 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      await route.fallback();
    });
    await page.goto("/businesses/b1/campaigns/k-4/logs");
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toBeVisible();

    const refresh = page.getByRole("button", { name: "Refresh" });
    await refresh.click();
    await expect(page.getByText("Refreshing…")).toBeVisible();
    await expect(refresh).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Refreshing…")).toHaveCount(0);
    expect(gets).toBe(2);
  });

  test("Delivery log of a queued campaign refreshes on its own", async ({ page }) => {
    await page.clock.install();
    const logs = { "k-3": [log("l-1", "k-3", "ada@example.com", { status: "PENDING", sentAt: null })] };
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, logs });
    const logGets = () =>
      state.requests.filter((request) => request.method === "GET" && request.path.endsWith("/k-3/logs")).length;
    await page.goto("/businesses/b1/campaigns/k-3/logs");
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toContainText("Pending");
    expect(logGets()).toBe(1);

    logs["k-3"] = [log("l-1", "k-3", "ada@example.com")];
    await page.clock.runFor(16_000);
    await expect.poll(logGets).toBeGreaterThan(1);
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toContainText("Sent");
  });

  test("a failed campaign says it did not finish and names the most common reason", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [failedCampaign] },
      analytics: {
        "k-5": {
          eligibleCount: 4,
          failedDeliveryCount: 4,
          failedByReason: { "Mailbox does not exist": 3, "Daily limit reached for this account": 1 },
        },
      },
    });
    await page.goto("/businesses/b1/campaigns/k-5/analytics");

    await expect(
      page.getByText("Most common failure reason: Mailbox does not exist (3 of 4 failed messages).", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("This campaign didn’t finish sending.", { exact: true })).toBeVisible();
  });
});
