import { expect, test, type Page } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const RECOVERY_LINK =
  "/reset-password#access_token=test-access-token&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery";
const CONFIRMATION = "a reset link is on its way. Check your inbox and spam folder.";

/** Answers the token-validation request supabase-js makes for a recovery link as an expired token would. */
async function rejectRecoveryToken(page: Page) {
  await page.route("https://example.supabase.co/auth/v1/user", async (route) => {
    if (route.request().method() !== "GET") {
      return route.fallback();
    }
    return route.fulfill({
      status: 401,
      headers: { "access-control-allow-origin": "*" },
      contentType: "application/json",
      body: JSON.stringify({ code: 401, error_code: "bad_jwt", msg: "invalid JWT: token is expired" }),
    });
  });
}

test("the login page links to the forgot-password page", async ({ page }) => {
  await page.goto("/login");
  const link = page.getByRole("link", { name: "Forgot password?" });
  await expect(link).toHaveAttribute("href", "/forgot-password");
  await link.click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
});

test("the forgot-password page validates the email inline without a network call", async ({ page }) => {
  const state = await mockApi(page, { businesses: [bakery] });
  await page.goto("/forgot-password");
  const email = page.getByRole("textbox", { name: "Email", exact: true });

  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(email).toBeFocused();

  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(email).toBeFocused();

  expect(state.authRequests.filter((request) => request.path === "/auth/v1/recover")).toHaveLength(0);
});

test("a valid email sends one reset request and shows the neutral confirmation", async ({ page }) => {
  const state = await mockApi(page, { businesses: [bakery] });
  await page.goto("/forgot-password");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill(" ada@example.com ");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(`If an account exists for ada@example.com, ${CONFIRMATION}`)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to log in" })).toHaveAttribute("href", "/login");

  const recovers = state.authRequests.filter((request) => request.path === "/auth/v1/recover");
  expect(recovers).toHaveLength(1);
  expect(recovers[0].body).toMatchObject({ email: "ada@example.com" });
  const redirectTo = new URLSearchParams(recovers[0].search).get("redirect_to");
  expect(redirectTo).toMatch(/\/reset-password$/);
});

test("an address with no account gets exactly the same confirmation", async ({ page }) => {
  // The mock answers 200 for every address, as Supabase does, so nothing here may depend on the answer.
  const state = await mockApi(page, { businesses: [bakery] });
  await page.goto("/forgot-password");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("nobody@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(
    page.getByText(`If an account exists for nobody@example.com, ${CONFIRMATION}`),
  ).toBeVisible();
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/recover")).toHaveLength(1);
});

test("an answer other than success or a rate limit still shows the neutral confirmation", async ({ page }) => {
  await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/recover*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fallback();
    }
    return route.fulfill({
      status: 400,
      headers: { "access-control-allow-origin": "*" },
      contentType: "application/json",
      body: JSON.stringify({ code: 400, error_code: "validation_failed", msg: "Unable to validate email address" }),
    });
  });
  await page.goto("/forgot-password");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByText(`If an account exists for ada@example.com, ${CONFIRMATION}`)).toBeVisible();
  await expect(page.getByText("Unable to validate email address")).toHaveCount(0);
});

test("a rate limit shows the error and keeps the form", async ({ page }) => {
  await mockApi(page, { businesses: [bakery], authErrors: { recover: "Email rate limit exceeded" } });
  await page.goto("/forgot-password");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Email rate limit exceeded" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("ada@example.com");
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expect(page.getByText(CONFIRMATION)).toHaveCount(0);
});

test("a network failure says the email was not sent and keeps the form", async ({ page }) => {
  await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/recover*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fallback();
    }
    return route.abort("failed");
  });
  await page.goto("/forgot-password");

  await page.getByRole("textbox", { name: "Email", exact: true }).fill("ada@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Could not send the email. Check your connection and try again." }),
  ).toBeVisible();
  await expect(page.getByText(CONFIRMATION)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send reset link" })).not.toHaveAttribute("aria-disabled", "true");
});

test("the reset page without a link says so and offers a new one", async ({ page }) => {
  await mockApi(page, { businesses: [bakery] });
  await page.goto("/reset-password");

  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("a signed-in visitor without a link does not get the form", async ({ page }) => {
  await signIn(page);
  await mockApi(page, { businesses: [bakery] });
  await page.goto("/reset-password");

  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel("New password")).toHaveCount(0);
});

test("a rejected link does not open the form, even when someone is already signed in", async ({ page }) => {
  await signIn(page);
  await mockApi(page, { businesses: [bakery] });
  await rejectRecoveryToken(page);
  // A different token from the seeded session's, as an emailed link would carry.
  await page.goto(RECOVERY_LINK.replace("test-access-token", "expired-link-token"));

  await expect(page.getByText("This reset link has expired or was already used.")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
  await expect(page.getByLabel("New password")).toHaveCount(0);
});

test("a slow link check waits instead of calling the link expired", async ({ page }) => {
  await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/user", async (route) => {
    if (route.request().method() === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
    }
    await route.fallback();
  });
  await page.goto(RECOVERY_LINK);

  await expect(page.getByText("Checking your reset link…")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New password", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("This reset link has expired or was already used.")).toHaveCount(0);
});

test("a valid recovery link opens the form, validates it and changes the password", async ({ page }) => {
  const state = await mockApi(page, { businesses: [bakery] });
  await page.goto(RECOVERY_LINK);

  const password = page.getByRole("textbox", { name: "New password", exact: true });
  const confirm = page.getByRole("textbox", { name: "Repeat new password", exact: true });
  await expect(password).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

  // supabase-js validated the token with GET /user and called no other endpoint.
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/user").map((request) => request.method)).toEqual([
    "GET",
  ]);

  // The link's tokens do not stay in the address bar.
  await expect.poll(() => new URL(page.url()).hash).toBe("");

  const change = page.getByRole("button", { name: "Change password" });
  await change.click();
  await expect(page.getByText("Enter a new password.")).toBeVisible();
  await expect(page.getByText("Repeat the new password.")).toBeVisible();
  await expect(password).toBeFocused();

  await password.fill("correct horse battery");
  await confirm.fill("something different");
  await change.click();
  await expect(page.getByText("The passwords don’t match.")).toBeVisible();
  await expect(confirm).toBeFocused();
  expect(state.authRequests.filter((request) => request.method === "PUT")).toHaveLength(0);

  await confirm.fill("correct horse battery");
  await change.click();

  await expect(page).toHaveURL(/\/businesses$/);
  await expect(page.getByText("Password changed")).toBeVisible();

  const updates = state.authRequests.filter((request) => request.method === "PUT" && request.path === "/auth/v1/user");
  expect(updates).toHaveLength(1);
  expect(updates[0].body).toMatchObject({ password: "correct horse battery" });
  const others = state.authRequests.filter(
    (request) => request.path === "/auth/v1/logout" && request.search?.includes("scope=others"),
  );
  expect(others).toHaveLength(1);
});

test("a password Supabase refuses is explained beside the field", async ({ page }) => {
  const state = await mockApi(page, {
    businesses: [bakery],
    authErrors: { updateUser: "Password should be at least 8 characters." },
  });
  await page.goto(RECOVERY_LINK);

  await page.getByRole("textbox", { name: "New password", exact: true }).fill("short");
  await page.getByRole("textbox", { name: "Repeat new password", exact: true }).fill("short");
  await page.getByRole("button", { name: "Change password" }).click();

  await expect(page.getByText("Password should be at least 8 characters.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New password", exact: true })).toBeFocused();
  await expect(page).toHaveURL(/\/reset-password/);
  expect(state.authRequests.filter((request) => request.path === "/auth/v1/logout")).toHaveLength(0);
});
