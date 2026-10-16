import { expect, test } from "@playwright/test";
import { business, campaign, customer, log, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
// Unbroken strings (no spaces, hyphens or slashes): browsers have no break opportunity inside them.
const LONG = "A".repeat(90);
const LONG_EMAIL = `${"a".repeat(70)}@${"b".repeat(30)}.example.com`;
const LONG_REASON = `Daily limit reached for this account and ${"z".repeat(80)}`;

const sent = campaign("k-4", LONG, {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
  message: `${LONG}${LONG}`,
});

const longDraft = campaign("k-1", LONG, { message: `${LONG}${LONG}` });

const mocks = {
  businesses: [bakery],
  customers: {
    b1: [customer("c-1", "Ada", { email: LONG_EMAIL, emailOptIn: true })],
  },
  campaigns: { b1: [sent, longDraft] },
  analytics: {
    "k-4": {
      eligibleCount: 4,
      sentCount: 2,
      failedDeliveryCount: 2,
      skippedBeforeSendCount: 1,
      skippedByReason: { "Customer has unsubscribed": 1 },
      failedByReason: { [LONG_REASON]: 2 },
    },
  },
  logs: {
    "k-4": [
      log("l-1", "k-4", LONG_EMAIL, {
        status: "FAILED",
        sentAt: null,
        errorMessage: LONG_REASON,
      }),
    ],
  },
};

test.describe("campaign detail and account: keyboard and small screens", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the tabs are reachable and operable with the keyboard", async ({ page }) => {
    await mockApi(page, mocks);
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    const tabs = page.getByRole("navigation", { name: "Campaign sections" });
    await tabs.getByRole("link", { name: "Audience" }).focus();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Results" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/campaigns\/k-4\/logs$/);
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toHaveAttribute("aria-current", "page");
  });

  test("deleting a draft can be done from the keyboard and Escape returns focus", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [campaign("k-1", "Spring menu")] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    const remove = page.getByRole("button", { name: "Delete" });
    await remove.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(remove).toBeFocused();
  });

  // A sent campaign, and an email draft (which also shows Review and send, Edit and Delete).
  const cases = [
    { id: "k-4", tab: "preview", marker: "Customers checked" },
    { id: "k-4", tab: "analytics", marker: "Eligible when queued" },
    { id: "k-4", tab: "logs", marker: "Why a message can fail" },
    { id: "k-1", tab: "preview", marker: "Customers checked" },
    { id: "k-1", tab: "analytics", marker: "No results yet" },
    { id: "k-1", tab: "logs", marker: "Why a message can fail" },
  ];
  for (const { id, tab, marker } of cases) {
    test(`the ${tab} tab of ${id === "k-1" ? "a draft" : "a sent campaign"} does not scroll sideways at 375px`, async ({
      page,
    }) => {
      await mockApi(page, mocks);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/businesses/b1/campaigns/${id}/${tab}`);

      // Wait for real content, not just the header.
      await expect(page.getByText(marker).first()).toBeVisible();
      if (id === "k-1") {
        await expect(page.getByRole("link", { name: "Review and send" }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the account page does not scroll sideways at 375px and its form is keyboard operable", async ({
    page,
  }) => {
    await mockApi(page, mocks);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 2, name: "Password" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("textbox", { name: "Current password", exact: true }).focus();
    await page.keyboard.type("old-password");
    await page.keyboard.press("Tab");
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Tab");
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Password changed")).toBeVisible();
  });
});
