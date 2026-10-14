import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const florist = business("b2", "Fern Florist");

const people = [
  customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true }),
  customer("c-2", "Grace", { email: "grace@navy.test", emailOptIn: true }),
  customer("c-3", "Alan", { email: "alan@bletchley.test", unsubscribedAt: "2026-09-01T00:00:00Z" }),
  customer("c-4", "Dee", { emailOptIn: true }),
];

async function goToMessageStep(page: import("@playwright/test").Page, name: string) {
  await page.getByLabel("Campaign name").fill(name);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("campaign wizard: steps", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("walks through basics, recipients and message, keeping what was typed", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");

    await expect(page.getByRole("heading", { level: 1, name: "New campaign" })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText("Basics");
    await expect(page.getByText("Campaigns are sent by email.")).toBeVisible();

    // A name made only of spaces is refused like an empty one.
    await page.getByLabel("Campaign name").fill("   ");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a campaign name.")).toBeVisible();
    await expect(page.getByLabel("Campaign name")).toBeFocused();

    await page.getByLabel("Campaign name").fill("Autumn menu");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Recipients" })).toBeFocused();
    await expect(page.locator('[aria-current="step"]')).toContainText("Recipients");
    await expect(page.getByText("3 customers have agreed to receive emails")).toBeVisible();
    await expect(page.getByText(/up to 10 recipients per campaign/i)).toBeVisible();
    await expect(page.getByText(/one campaign email per 24 hours/i)).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Message" })).toBeFocused();

    // An empty or whitespace-only message is refused.
    await page.getByRole("textbox", { name: "Message" }).fill(" \n ");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("Write the message your customers will read.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeFocused();

    await page.getByRole("textbox", { name: "Message" }).fill("Fresh pumpkin loaves are in.\nCome say hi.");
    const preview = page.getByRole("region", { name: "Email preview" });
    await expect(preview).toContainText("Corner Bakery");
    await expect(preview).toContainText("Autumn menu");
    await expect(preview).toContainText("Fresh pumpkin loaves are in.");
    await expect(preview).toContainText("unsubscribe link");

    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByLabel("Campaign name")).toHaveValue("Autumn menu");
  });

  test("warns when no customer has opted in, with a link to add customers", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [customer("c-9", "Sam", { email: "sam@example.com" })] },
    });
    await page.goto("/businesses/b1/campaigns/new");
    await page.getByLabel("Campaign name").fill("Autumn menu");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("No customers have agreed to receive emails yet")).toBeVisible();
    const link = page.getByRole("link", { name: /Add customers/ });
    await expect(link).toHaveAttribute("href", "/businesses/b1/customers");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("saves a draft from any step once there is a name and a message", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");

    const save = page.getByRole("button", { name: "Save draft" });
    await expect(save).toBeDisabled();
    await page.getByLabel("Campaign name").fill("Autumn menu");
    await expect(save).toBeDisabled();

    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText("Draft saved")).toBeVisible();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
    await expect(page.getByRole("link", { name: "Autumn menu" })).toBeVisible();

    const post = state.requests.find((request) => request.method === "POST" && request.path.endsWith("/campaigns"));
    expect(post?.body).toEqual({
      title: "Autumn menu",
      message: "Fresh loaves.",
      channel: "EMAIL",
      targetAudience: "ALL",
      sendAt: "",
    });
  });

  test("entering Review creates the draft once, shows exact recipients, and updates it on return", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");

    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeFocused();
    await expect(page.getByText(/We saved this campaign as a draft/)).toBeVisible();
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();
    await expect(page.getByText("2 customers will be skipped:")).toBeVisible();
    await expect(page.getByText("Hasn’t agreed to receive emails: 1")).toBeVisible();
    await expect(page.getByText("No email address: 1")).toBeVisible();

    // Going back and returning updates the same draft instead of creating another.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves, baked this morning.");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeVisible();
    await expect(page.getByText("Fresh loaves, baked this morning.")).toBeVisible();

    const writes = state.requests.filter(
      (request) => request.method === "POST" || request.method === "PUT",
    );
    expect(writes.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /api/businesses/b1/campaigns",
      "PUT /api/businesses/b1/campaigns/n-2000",
    ]);
  });

  test("a double click on Review creates exactly one draft", async ({ page }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      delayWritesMs: 400,
    });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");

    await page.getByRole("button", { name: "Review" }).dblclick();
    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeVisible();

    const posts = state.requests.filter(
      (request) => request.method === "POST" && request.path.endsWith("/campaigns"),
    );
    expect(posts).toHaveLength(1);
  });

  test("two submits in the same tick still create exactly one draft", async ({ page }) => {
    // Both submits run before React re-renders, so only the in-flight guard (not the disabled
    // button) can stop the second one.
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      delayWritesMs: 400,
    });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");

    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (!form) {
        throw new Error("wizard form not found");
      }
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeVisible();
    // Give a stray second request time to arrive before counting.
    await page.waitForTimeout(600);

    const posts = state.requests.filter(
      (request) => request.method === "POST" && request.path.endsWith("/campaigns"),
    );
    expect(posts).toHaveLength(1);
  });

  test("shows a server validation error on the step that owns the field", async ({ page }) => {
    // The mock refuses a POST with an empty title; trimming makes that unreachable from the UI,
    // so force it by letting the first request through with a stale (blank) title via route override.
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.route("**/api/businesses/b1/campaigns", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          error: "Invalid request body",
          details: [{ path: ["title"], message: "Campaign title is required" }],
        }),
      });
    });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Basics" })).toBeVisible();
    await expect(page.getByText("Campaign title is required")).toBeVisible();
    await expect(page.getByLabel("Campaign name")).toBeFocused();
  });
});

test.describe("campaign wizard: editing", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("opens a draft with its values and updates it instead of creating a new one", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      campaigns: {
        b1: [campaign("k-1", "Spring menu", { message: "Blossom buns are back." })],
      },
    });
    await page.goto("/businesses/b1/campaigns/k-1/edit");

    await expect(page.getByRole("heading", { level: 1, name: "Edit campaign" })).toBeVisible();
    await expect(page.getByLabel("Campaign name")).toHaveValue("Spring menu");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("textbox", { name: "Message" })).toHaveValue("Blossom buns are back.");

    await page.getByRole("textbox", { name: "Message" }).fill("Blossom buns are back, with jam.");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

    const writes = state.requests.filter(
      (request) => request.method === "POST" || request.method === "PUT",
    );
    expect(writes.map((request) => `${request.method} ${request.path}`)).toEqual([
      "PUT /api/businesses/b1/campaigns/k-1",
    ]);
    expect(writes[0].body).toMatchObject({ title: "Spring menu", message: "Blossom buns are back, with jam." });
  });

  test("explains why a sent, queued or SMS campaign cannot be edited, and handles an unknown id", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: {
        b1: [
          campaign("k-4", "Loyalty thanks", { status: "SENT" }),
          campaign("k-3", "Weekend offer", { status: "QUEUED" }),
          campaign("k-6", "Text blast", { channel: "SMS" }),
        ],
      },
    });

    await page.goto("/businesses/b1/campaigns/k-4/edit");
    await expect(page.getByRole("heading", { name: "This campaign can’t be edited" })).toBeVisible();
    await expect(page.getByText("Queued and sent campaigns can’t be edited.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to campaigns" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns",
    );

    await page.goto("/businesses/b1/campaigns/k-3/edit");
    await expect(page.getByText("Queued and sent campaigns can’t be edited.")).toBeVisible();

    await page.goto("/businesses/b1/campaigns/k-6/edit");
    await expect(page.getByText(/SMS sending is paused/)).toBeVisible();

    await page.goto("/businesses/b1/campaigns/nope/edit");
    await expect(page.getByRole("heading", { name: "Campaign not found" })).toBeVisible();
    await expect(page.getByLabel("Campaign name")).toHaveCount(0);
  });

  test("Edit in the list opens the wizard for that draft", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [campaign("k-1", "Spring menu")] },
    });
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/businesses/b1/campaigns");

    await page.getByRole("button", { name: "Actions for Spring menu" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns\/k-1\/edit$/);
    await expect(page.getByLabel("Campaign name")).toHaveValue("Spring menu");
  });

  test("switching business in the middle of the wizard lands on that business's campaigns", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery, florist], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");
    await page.getByLabel("Campaign name").fill("Half written");

    await page.getByRole("button", { name: /Managing Corner Bakery/ }).click();
    await page.getByRole("menuitemradio", { name: "Fern Florist" }).click();

    await expect(page).toHaveURL(/\/businesses\/b2\/campaigns$/);
    await expect(page.getByRole("heading", { level: 1, name: "Campaigns" })).toBeVisible();
  });
});
