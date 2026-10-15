import { expect, test } from "@playwright/test";
import { business, campaign, customer, log, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const LONG = "A-campaign-name-without-any-spaces-that-is-much-longer-than-a-phone-screen-is-wide";

const sent = campaign("k-4", LONG, {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
  message: `${LONG}${LONG}`,
});

const mocks = {
  businesses: [bakery],
  customers: {
    b1: [customer("c-1", "Ada", { email: "ada-with-a-very-long-address-that-keeps-going@example.com", emailOptIn: true })],
  },
  campaigns: { b1: [sent] },
  analytics: {
    "k-4": {
      eligibleCount: 4,
      sentCount: 2,
      failedDeliveryCount: 2,
      skippedBeforeSendCount: 1,
      skippedByReason: { "Customer has unsubscribed": 1 },
      failedByReason: { "Daily limit reached for this account and this is an unbroken-reason-string-that-is-very-long": 2 },
    },
  },
  logs: {
    "k-4": [
      log("l-1", "k-4", "ada-with-a-very-long-address-that-keeps-going@example.com", {
        status: "FAILED",
        sentAt: null,
        errorMessage: "Daily limit reached for this account and this is an unbroken-reason-string-that-is-very-long",
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

  for (const tab of ["preview", "analytics", "logs"]) {
    test(`the ${tab} tab does not scroll sideways at 375px`, async ({ page }) => {
      await mockApi(page, mocks);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/businesses/b1/campaigns/k-4/${tab}`);

      // Wait for real content, not just the header.
      const marker = {
        preview: "Customers checked",
        analytics: "Eligible when queued",
        logs: "Why a message can fail",
      }[tab]!;
      await expect(page.getByText(marker).first()).toBeVisible();

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

    await page.getByRole("textbox", { name: "New password", exact: true }).focus();
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Tab");
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Password changed")).toBeVisible();
  });
});
