import { expect, test } from "@playwright/test";
import { business, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const optedIn = Array.from({ length: 6 }, (_, index) =>
  customer(`c-${index + 1}`, `Opted${index + 1}`, {
    email: `opted${index + 1}@example.com`,
    emailOptIn: true,
  }),
);
// The API stores people without consent as unsubscribed, so these look "unsubscribed" to it.
const notOptedIn = Array.from({ length: 4 }, (_, index) =>
  customer(`c-${index + 7}`, `Quiet${index + 1}`, { unsubscribedAt: "2026-09-01T00:00:00Z" }),
);

const busyDashboard = {
  campaigns: { total: 4, draft: 1, queued: 1, sent: 1, failed: 1 },
  messages: { totalLogs: 10, sent: 8, failed: 1, pending: 1, successRate: 89 },
  recentCampaigns: [
    {
      id: "k-1",
      title: "Spring sale",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "SENT" as const,
      createdAt: "2026-10-01T12:00:00Z",
    },
    {
      id: "k-2",
      title: "Autumn teaser",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "DRAFT" as const,
      createdAt: "2026-10-05T12:00:00Z",
    },
    {
      id: "k-3",
      title: "Flash offer",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "FAILED" as const,
      createdAt: "2026-10-06T12:00:00Z",
    },
    {
      id: "k-4",
      title: "Weekend deal",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "QUEUED" as const,
      createdAt: "2026-10-07T12:00:00Z",
    },
  ],
};

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a new business shows the setup checklist and no delivery data", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const checklist = page.getByRole("region", { name: "Get started" });
    await expect(checklist).toBeVisible();
    await expect(checklist.getByText("Add your first customer", { exact: true })).toBeVisible();
    await expect(checklist.getByText("Send your first campaign", { exact: true })).toBeVisible();

    await expect(page.getByRole("region", { name: "Customers" })).toContainText("0 customers");
    await expect(page.getByRole("region", { name: "Delivery" })).toContainText("No messages sent yet");
    await expect(page.getByText(/NaN/)).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Messages:/ })).toHaveCount(0);
  });

  test("adding the first customer updates the checklist and the counts", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    const checklist = page.getByRole("region", { name: "Get started" });
    await checklist.getByRole("button", { name: "Add customer" }).click();

    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await dialog.getByLabel("First name").fill("Katherine");
    await dialog.getByLabel("Customer explicitly agreed to receive promotional emails").check();
    await dialog.getByRole("button", { name: "Add customer" }).click();

    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("1 customer");
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("Opted in to email");
    await expect(checklist.getByRole("listitem").first()).toContainText("(done)");
    // The campaign step is still open, so the checklist stays.
    await expect(checklist).toBeVisible();
  });

  test("keeps keyboard focus on the page title after adding the first customer", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    // The checklist button unmounts once the dashboard refetches; focus must not fall to <body>.
    const checklist = page.getByRole("region", { name: "Get started" });
    await checklist.getByRole("button", { name: "Add customer" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await dialog.getByLabel("First name").fill("Katherine");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("1 customer");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeFocused();
  });

  test("shows customers, campaigns, delivery and recent campaigns from real numbers", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn, ...notOptedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    // Setup is complete, so the checklist is gone.
    await expect(page.getByRole("region", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);

    const customers = page.getByRole("region", { name: "Customers" });
    await expect(customers).toContainText("10 customers");
    await expect(customers.getByText("Opted in to email")).toBeVisible();
    await expect(customers.locator("div").filter({ hasText: /^Opted in to email6$/ })).toBeVisible();
    // Derived from total - opted in, never the API's "unsubscribed" label.
    await expect(customers.locator("div").filter({ hasText: /^Not opted in4$/ })).toBeVisible();
    await expect(page.getByText("Unsubscribed")).toHaveCount(0);

    const campaigns = page.getByRole("region", { name: "Campaigns", exact: true });
    await expect(campaigns).toContainText("4 campaigns");
    for (const status of ["Draft", "Queued", "Sent", "Failed"]) {
      await expect(campaigns.getByText(status, { exact: true })).toBeVisible();
    }

    const delivery = page.getByRole("region", { name: "Delivery" });
    await expect(page.getByRole("img", { name: "Messages: 8 sent, 1 failed, 1 pending" })).toBeVisible();
    await expect(delivery).toContainText("89% success rate");
    await expect(delivery).toContainText("pending messages not counted");
    await expect(delivery.locator("div").filter({ hasText: /^Sent8 \(80%\)$/ })).toBeVisible();

    const recent = page.getByRole("region", { name: "Recent campaigns" });
    await expect(recent.getByRole("link", { name: "Spring sale" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/analytics",
    );
    await expect(recent.getByRole("link", { name: "Autumn teaser" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-2/preview",
    );
    await expect(recent.getByText("Flash offer")).toBeVisible();
  });

  test("Not opted in is derived from the totals, not from the API's unsubscribed count", async ({
    page,
  }) => {
    // total 4, emailOptedIn 2, but the API's `unsubscribed` is 1: the numbers must diverge.
    const diverging = [
      customer("d-1", "Opted1", { email: "d1@example.com", emailOptIn: true }),
      customer("d-2", "Opted2", { email: "d2@example.com", emailOptIn: true }),
      // Legacy row: never opted in and not marked unsubscribed.
      customer("d-3", "Legacy", { emailOptIn: false, unsubscribedAt: null }),
      // Opted in, then unsubscribed.
      customer("d-4", "Left", {
        email: "d4@example.com",
        emailOptIn: true,
        unsubscribedAt: "2026-09-01T00:00:00Z",
      }),
    ];
    await mockApi(page, { businesses: [bakery], customers: { b1: diverging } });
    await page.goto("/businesses/b1/dashboard");

    const customers = page.getByRole("region", { name: "Customers" });
    await expect(customers).toContainText("4 customers");
    await expect(customers.locator("div").filter({ hasText: /^Opted in to email2$/ })).toBeVisible();
    await expect(customers.locator("div").filter({ hasText: /^Not opted in2$/ })).toBeVisible();
    await expect(customers.locator("div").filter({ hasText: /^Not opted in1$/ })).toHaveCount(0);
  });

  test("a tiny failed share stays visible in the bar and the legend", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      dashboards: {
        b1: {
          campaigns: { total: 1, sent: 1 },
          messages: { totalLogs: 1001, sent: 1000, failed: 1, pending: 0, successRate: 100 },
        },
      },
    });
    await page.goto("/businesses/b1/dashboard");

    const bar = page.getByRole("img", { name: "Messages: 1000 sent, 1 failed, 0 pending" });
    await expect(bar).toBeVisible();

    const failedSegment = bar.locator('[title^="Failed"]');
    const box = await failedSegment.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(3.5);

    const delivery = page.getByRole("region", { name: "Delivery" });
    await expect(delivery.locator("div").filter({ hasText: /^Sent1000 \(>99%\)$/ })).toBeVisible();
    await expect(delivery.locator("div").filter({ hasText: /^Failed1 \(<1%\)$/ })).toBeVisible();
    await expect(delivery.locator("div").filter({ hasText: /^Pending0 \(0%\)$/ })).toBeVisible();
    // Computed from the counts, so it cannot read 100% beside a failure (the API said 100).
    await expect(delivery).toContainText(">99% success rate");
    await expect(delivery).not.toContainText("100% success rate");
  });

  test("quick actions open the customer dialog and the campaigns page", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("main").getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await expect(dialog.getByLabel("First name")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "New campaign" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
  });

  test("a failed load shows an error with a retry", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      failFirstDashboardGet: true,
    });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("heading", { name: /Couldn.t load the dashboard/ })).toBeVisible();
    await expect(page.getByText("Dashboard unavailable")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("6 customers");
  });
});

test.describe("dashboard on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("stacks the panels without horizontal scroll", async ({ page }) => {
    await signIn(page);
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn, ...notOptedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("img", { name: /Messages:/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent campaigns" })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });
});
