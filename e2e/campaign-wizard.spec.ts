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
    // The email is sent from DireConnect's address; the business name is in the header and
    // the opt-in line, and there is no sender row naming the business.
    await expect(preview).toContainText("Promotion from Corner Bakery");
    await expect(preview).toContainText("opted in to promotions from Corner Bakery");
    await expect(preview).toContainText("Powered by DireConnect");
    await expect(preview.getByText("From", { exact: true })).toHaveCount(0);
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

async function reachReview(page: import("@playwright/test").Page) {
  await page.goto("/businesses/b1/campaigns/new");
  await goToMessageStep(page, "Autumn menu");
  await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();
}

test.describe("campaign wizard: review and send", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("sends now after confirming, saving the timing before queueing", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await expect(page.getByRole("radio", { name: "Send now" })).toBeChecked();
    await page.getByRole("button", { name: "Send now" }).click();

    const dialog = page.getByRole("dialog", { name: "Send to 2 customers now?" });
    await expect(dialog).toContainText("Queued campaigns can’t be edited or cancelled.");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Send now" }).click();

    await expect(page.getByText("Campaign queued")).toBeVisible();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns\/n-2000\/analytics$/);

    const order = state.requests
      .filter((request) => request.method !== "GET")
      .map((request) => `${request.method} ${request.path}`);
    expect(order).toEqual([
      "POST /api/businesses/b1/campaigns",
      "PUT /api/businesses/b1/campaigns/n-2000",
      "POST /api/businesses/b1/campaigns/n-2000/queue",
    ]);
    const put = state.requests.find((request) => request.method === "PUT");
    expect(put?.body).toMatchObject({ sendAt: "" });
  });

  test("cancelling the confirmation sends nothing", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await page.getByRole("button", { name: "Send now" }).click();
    await page
      .getByRole("dialog", { name: "Send to 2 customers now?" })
      .getByRole("button", { name: "Cancel" })
      .click();

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);
  });

  test("schedules for a future time, sent as an ISO instant, and refuses empty and past times", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await page.getByRole("radio", { name: "Schedule for later" }).check();
    await expect(page.getByText(/Times are shown in your time zone \(/)).toBeVisible();

    const submit = page.getByRole("button", { name: "Schedule campaign" });
    await submit.click();
    await expect(page.getByText("Choose a date and time.")).toBeVisible();
    await expect(page.getByLabel("Date and time")).toBeFocused();

    await page.getByLabel("Date and time").fill("2020-01-01T09:00");
    await submit.click();
    await expect(page.getByText("Choose a time in the future.")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByLabel("Date and time").fill("2099-01-01T09:30");
    await submit.click();
    const dialog = page.getByRole("dialog", { name: "Schedule for 2 customers?" });
    await expect(dialog).toContainText("Jan 1, 2099");
    await dialog.getByRole("button", { name: "Schedule campaign" }).click();

    await expect(page.getByText("Campaign scheduled")).toBeVisible();
    await expect(page).toHaveURL(/\/campaigns\/n-2000\/analytics$/);

    const expected = await page.evaluate(() => new Date("2099-01-01T09:30").toISOString());
    const put = state.requests.find((request) => request.method === "PUT");
    expect(put?.body).toMatchObject({ sendAt: expected });
  });

  test("a double click on the confirmation queues the campaign once", async ({ page }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      delayWritesMs: 400,
    });
    await reachReview(page);

    await page.getByRole("button", { name: "Send now" }).click();
    await page
      .getByRole("dialog", { name: "Send to 2 customers now?" })
      .getByRole("button", { name: "Send now" })
      .dblclick();

    await expect(page).toHaveURL(/\/analytics$/);
    const queues = state.requests.filter((request) => request.path.endsWith("/queue"));
    expect(queues).toHaveLength(1);
  });

  test("two confirmations in the same tick still queue the campaign once", async ({ page }) => {
    // A disabled button stops a real double click, so call the confirm button's click handler
    // twice before React re-renders: only the in-flight guard can stop the second call.
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      delayWritesMs: 400,
    });
    await reachReview(page);

    await page.getByRole("button", { name: "Send now" }).click();
    const dialog = page.getByRole("dialog", { name: "Send to 2 customers now?" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Send now" }).evaluate((button) => {
      const propsKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
      const props = propsKey
        ? (button as unknown as Record<string, { onClick?: () => void }>)[propsKey]
        : undefined;
      if (!props?.onClick) {
        throw new Error("confirm button has no React click handler");
      }
      props.onClick();
      props.onClick();
    });

    await expect(page).toHaveURL(/\/analytics$/);
    // Give a stray second request time to arrive before counting.
    await page.waitForTimeout(600);
    const queues = state.requests.filter((request) => request.path.endsWith("/queue"));
    expect(queues).toHaveLength(1);
  });

  test("blocks sending, with an explanation, when no one can receive the campaign", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [customer("c-9", "Sam", { email: "sam@example.com" })] },
    });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByText("No one can receive this campaign yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
  });

  test("blocks sending above the recipient limit and states the numbers", async ({ page }) => {
    const crowd = Array.from({ length: 11 }, (_, index) =>
      customer(`c-${index}`, `Person${index}`, { email: `p${index}@example.com`, emailOptIn: true }),
    );
    await mockApi(page, { businesses: [bakery], customers: { b1: crowd } });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByRole("textbox", { name: "Message" }).fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByText("Too many recipients")).toBeVisible();
    await expect(page.getByText(/limited to 10 recipients/)).toBeVisible();
    await expect(page.getByText(/would reach 11/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  });

  test("shows the server's refusal on the Review step, keeps the draft, and allows another try", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      queueError: { status: 403, error: "Campaign sending is not enabled for this account." },
    });
    await reachReview(page);

    await page.getByRole("button", { name: "Send now" }).click();
    await page
      .getByRole("dialog", { name: "Send to 2 customers now?" })
      .getByRole("button", { name: "Send now" })
      .click();

    await expect(page.getByRole("dialog")).toBeHidden();
    const panel = page.getByRole("alert").filter({ hasText: "The campaign wasn’t sent" });
    await expect(panel).toContainText("Campaign sending is not enabled for this account.");
    await expect(panel).toContainText("Your draft is saved");
    await expect(panel).toBeFocused();
    await expect(page).toHaveURL(/\/campaigns\/new$/);
    await expect(page.getByRole("button", { name: "Send now" })).toBeEnabled();

    // The panel stays until the user acts: going back to edit clears it.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("The campaign wasn’t sent")).toHaveCount(0);

    // The draft is kept and can be saved.
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
    await expect(page.getByRole("link", { name: "Autumn menu" })).toBeVisible();
    expect(state.campaigns.b1.map((item) => item.status)).toEqual(["DRAFT"]);
  });

  test("opens a draft with a future send time as a schedule, and one with a past time as Send now", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      campaigns: {
        b1: [
          campaign("k-1", "Future send", { sendAt: "2099-06-01T08:00:00.000Z" }),
          campaign("k-2", "Past send", { sendAt: "2020-06-01T08:00:00.000Z" }),
        ],
      },
    });

    for (const [id, expectSchedule] of [
      ["k-1", true],
      ["k-2", false],
    ] as const) {
      await page.goto(`/businesses/b1/campaigns/${id}/edit`);
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Review" }).click();
      await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

      if (expectSchedule) {
        await expect(page.getByRole("radio", { name: "Schedule for later" })).toBeChecked();
        await expect(page.getByLabel("Date and time")).not.toHaveValue("");
      } else {
        await expect(page.getByRole("radio", { name: "Send now" })).toBeChecked();
        await expect(page.getByLabel("Date and time")).toHaveCount(0);
        await expect(page.getByText("Choose a time in the future.")).toHaveCount(0);
      }
    }
  });
});

test.describe("campaign wizard: unconfirmed email", () => {
  test("blocks sending until the account email is confirmed", async ({ page }) => {
    // No file-level sign-in applies here, so this session is the only one the page sees.
    await signIn(page, { emailConfirmed: false });
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await expect(page.getByText("Confirm your email address first")).toBeVisible();
    await expect(page.getByText("Open your Account page to resend the confirmation email")).toBeVisible();
    const accountLink = page.getByRole("link", { name: "Open Account (opens in a new tab)" });
    await expect(accountLink).toHaveAttribute("href", "/account");
    await expect(accountLink).toHaveAttribute("target", "_blank");
    await expect(accountLink).toHaveAttribute("rel", /noopener/);
    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  });
});

const cors = { "access-control-allow-origin": "*" };

test.describe("campaign wizard: ambiguous and repeated sends", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  async function confirmSend(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Send now" }).click();
    await page
      .getByRole("dialog", { name: "Send to 2 customers now?" })
      .getByRole("button", { name: "Send now" })
      .click();
  }

  test("a lost queue response that actually queued the campaign is treated as sent", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    // The server queues the campaign, but the response never reaches the browser.
    await page.route("**/api/businesses/b1/campaigns/n-2000/queue", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      const draft = state.campaigns.b1.find((item) => item.id === "n-2000");
      if (draft) {
        draft.status = "QUEUED";
      }
      return route.abort();
    });

    await confirmSend(page);

    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns\/n-2000\/analytics$/);
    await expect(page.getByText("Campaign queued")).toBeVisible();
    await expect(page.getByText("The campaign wasn’t sent")).toHaveCount(0);
  });

  test("a 404 on the timing save after the campaign was queued is treated as sent", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await page.route("**/api/businesses/b1/campaigns/n-2000", async (route) => {
      if (route.request().method() !== "PUT") {
        return route.fallback();
      }
      const draft = state.campaigns.b1.find((item) => item.id === "n-2000");
      if (draft) {
        draft.status = "QUEUED";
      }
      return route.fulfill({
        status: 404,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Campaign not found. Queued or sent campaigns cannot be edited.",
        }),
      });
    });

    await confirmSend(page);

    await expect(page).toHaveURL(/\/campaigns\/n-2000\/analytics$/);
    await expect(page.getByText("The campaign wasn’t sent")).toHaveCount(0);
  });

  test("after a successful send nothing on the Review step can be used while navigation completes", async ({
    page,
  }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    // Hold the navigation so the Review step is still on screen after the queue succeeds.
    await page.route("**/campaigns/n-2000/analytics?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      return route.continue();
    });

    await confirmSend(page);
    await expect(page.getByText("Campaign queued")).toBeVisible();

    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
    await expect(page.getByText("The campaign wasn’t sent")).toHaveCount(0);

    await expect(page).toHaveURL(/\/analytics$/);
    const queues = state.requests.filter((request) => request.path.endsWith("/queue"));
    expect(queues).toHaveLength(1);
  });

  test("a server error on queue with the draft still a draft shows the panel", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await page.route("**/api/businesses/b1/campaigns/n-2000/queue", async (route) => {
      if (route.request().method() !== "POST") {
        return route.fallback();
      }
      return route.fulfill({
        status: 503,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify({ error: "Service unavailable." }),
      });
    });

    await confirmSend(page);

    const panel = page.getByRole("alert").filter({ hasText: "The campaign wasn’t sent" });
    await expect(panel).toContainText("Service unavailable.");
    await expect(panel).toContainText("Your draft is saved");
    await expect(page).toHaveURL(/\/campaigns\/new$/);

    // The wizard checked the list before reporting the failure.
    const listReads = state.requests.filter(
      (request) => request.method === "GET" && request.path === "/api/businesses/b1/campaigns",
    );
    expect(listReads.length).toBeGreaterThan(0);
  });

  test("says so, without claiming the draft is saved, when it cannot confirm what happened", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await page.route("**/api/businesses/b1/campaigns/n-2000/queue", (route) =>
      route.request().method() === "POST" ? route.abort() : route.fallback(),
    );
    await page.route("**/api/businesses/b1/campaigns", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            headers: cors,
            contentType: "application/json",
            body: JSON.stringify({ error: "Could not load campaigns." }),
          })
        : route.fallback(),
    );

    await confirmSend(page);

    const panel = page.getByRole("alert").filter({ hasText: "The campaign wasn’t sent" });
    await expect(panel).toContainText(
      "We couldn’t confirm whether the campaign was sent. Check Campaigns before trying again.",
    );
    await expect(panel).not.toContainText("Your draft is saved");
    await expect(page).toHaveURL(/\/campaigns\/new$/);
  });

  test("a refusal about recipients refreshes the recipient numbers", async ({ page }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      queueError: { status: 409, error: "This campaign has no eligible, opted-in email recipients." },
    });
    await reachReview(page);

    const previewReads = () =>
      state.requests.filter(
        (request) => request.method === "GET" && request.path.endsWith("/n-2000/preview"),
      ).length;
    const before = previewReads();
    expect(before).toBeGreaterThan(0);

    await confirmSend(page);

    const panel = page.getByRole("alert").filter({ hasText: "The campaign wasn’t sent" });
    await expect(panel).toContainText("no eligible, opted-in email recipients");
    await expect(panel).toContainText("Your draft is saved");
    await expect.poll(previewReads).toBeGreaterThan(before);
  });

  test("explains the wait when confirming takes longer than usual", async ({ page }) => {
    test.setTimeout(60_000);
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: people },
      delayWritesMs: 5_000,
    });
    await reachReview(page);

    await page.getByRole("button", { name: "Send now" }).click();
    const dialog = page.getByRole("dialog", { name: "Send to 2 customers now?" });
    await expect(dialog).not.toContainText("Waking up the server");
    await dialog.getByRole("button", { name: "Send now" }).click();

    await expect(dialog).toContainText("Waking up the server", { timeout: 8_000 });
    await expect(page).toHaveURL(/\/analytics$/, { timeout: 20_000 });
  });
});
