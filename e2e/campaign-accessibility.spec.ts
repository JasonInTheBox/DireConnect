import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const people = [
  customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true }),
  customer("c-2", "Grace", { email: "grace@navy.test", emailOptIn: true }),
];

test.describe("campaign pages: keyboard and small screens", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the whole wizard can be completed with the keyboard", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");

    await page.getByLabel("Campaign name").focus();
    await page.keyboard.type("Autumn menu");
    await page.keyboard.press("Enter"); // submits the step: Continue
    await expect(page.getByRole("heading", { level: 2, name: "Recipients" })).toBeFocused();

    await page.getByRole("button", { name: "Continue" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Message" })).toBeFocused();

    await page.getByRole("textbox", { name: "Message" }).focus();
    await page.keyboard.type("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

    await page.getByRole("button", { name: "Send now" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Send to 2 customers now?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Send now" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/analytics$/);
  });

  test("Escape closes the confirmation and returns focus to the send button", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");
    await page.getByLabel("Campaign name").fill("Autumn menu");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

    const send = page.getByRole("button", { name: "Send now" });
    await send.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(send).toBeFocused();
  });

  for (const path of ["/businesses/b1/campaigns", "/businesses/b1/campaigns/new"]) {
    test(`${path} does not scroll sideways at 375px`, async ({ page }) => {
      await mockApi(page, {
        businesses: [bakery],
        customers: { b1: people },
        campaigns: {
          b1: [
            campaign("k-1", "A campaign name that is much longer than the phone screen is wide, to test wrapping"),
            campaign("k-4", "Loyalty thanks", { status: "SENT" }),
          ],
        },
        analytics: { "k-4": { eligibleCount: 4, sentCount: 3, failedDeliveryCount: 1 } },
      });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
