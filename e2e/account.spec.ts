import { expect, test, type Page } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const userUpdates = (state: { authRequests: Array<{ path: string }> }) =>
  state.authRequests.filter((request) => request.path === "/auth/v1/user");

async function fillPasswordForm(page: Page, current: string, next: string, repeat = next) {
  await field(page, "Current password").fill(current);
  await field(page, "New password").fill(next);
  await field(page, "Repeat new password").fill(repeat);
  await page.getByRole("button", { name: "Change password" }).click();
}

test.describe("account page", () => {
  test("shows the email, its status, and an Account entry in the sidebar", async ({ page }) => {
    await signIn(page);
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    const signIn_ = page.getByRole("region", { name: "Sign-in" });
    await expect(signIn_).toContainText("owner@example.com");
    await expect(signIn_).toContainText("Email confirmed");
    await expect(signIn_.getByRole("button", { name: "Resend confirmation email" })).toHaveCount(0);

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
  });

  test("never sends an empty or mismatched password", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Enter your current password.")).toBeVisible();
    await expect(page.getByText("Enter a new password.")).toBeVisible();
    await expect(page.getByText("Repeat the new password.")).toBeVisible();
    await expect(field(page, "Current password")).toBeFocused();

    await fillPasswordForm(page, "old-password", "one-password", "another-one");
    await expect(page.getByText("The passwords don’t match.")).toBeVisible();

    // Let the page settle so an asynchronous send could not slip past the checks below.
    await page.waitForTimeout(500);
    expect(userUpdates(state)).toHaveLength(0);
    expect(state.authRequests).toHaveLength(0);
  });

  test("refuses a new password equal to the current one", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await fillPasswordForm(page, "same-password", "same-password");

    await expect(
      page.getByText("Choose a password that is different from the current one."),
    ).toBeVisible();
    await expect(field(page, "New password")).toBeFocused();

    await page.waitForTimeout(500);
    expect(state.authRequests).toHaveLength(0);
  });

  test("a wrong current password is caught beside its field and never changes the password", async ({
    page,
  }) => {
    await signIn(page);
    const state = await mockApi(page, {
      businesses: [bakery],
      authErrors: { signIn: "Invalid login credentials" },
    });
    await page.goto("/account");

    await fillPasswordForm(page, "not-my-password", "a-better-password");

    await expect(page.getByText("That isn’t your current password.")).toBeVisible();
    await expect(field(page, "Current password")).toBeFocused();
    await expect(field(page, "Current password")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "New password")).toHaveValue("a-better-password");
    await expect(page.getByText("Password changed")).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(userUpdates(state)).toHaveLength(0);
    expect(state.authRequests.some((request) => request.path === "/auth/v1/logout")).toBe(false);
    // The check was the password grant; what was typed travels in the body, never in the URL.
    const attempt = state.authRequests.find((request) => request.path === "/auth/v1/token");
    expect(attempt?.search).toBe("?grant_type=password");
    expect(attempt?.body).toMatchObject({ email: "owner@example.com", password: "not-my-password" });
  });

  test("a refused check that is not a wrong password shows as a form error and changes nothing", async ({
    page,
  }) => {
    await signIn(page);
    const state = await mockApi(page, {
      businesses: [bakery],
      authErrors: {
        signIn: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" },
      },
    });
    await page.goto("/account");

    await fillPasswordForm(page, "old-password", "a-better-password");

    await expect(page.getByRole("alert").filter({ hasText: "Email not confirmed" })).toBeVisible();
    await expect(page.getByText("That isn’t your current password.")).toHaveCount(0);
    await expect(field(page, "New password")).toHaveValue("a-better-password");
    await expect(page.getByText("Password changed")).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(userUpdates(state)).toHaveLength(0);
    expect(state.authRequests.some((request) => request.path === "/auth/v1/logout")).toBe(false);
  });

  test("changes the password, ends the other sessions and clears the fields", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await fillPasswordForm(page, "old-password", "a-better-password");

    await expect(page.getByText("Password changed", { exact: true })).toBeVisible();
    await expect(field(page, "Current password")).toHaveValue("");
    await expect(field(page, "New password")).toHaveValue("");
    await expect(field(page, "Repeat new password")).toHaveValue("");

    // Verify the old password, change it, then end the other sessions (this one stays signed in).
    expect(
      state.authRequests.map((request) => `${request.method} ${request.path}${request.search ?? ""}`),
    ).toEqual([
      "POST /auth/v1/token?grant_type=password",
      "PUT /auth/v1/user",
      "POST /auth/v1/logout?scope=others",
    ]);
    expect(state.authRequests[0].body).toMatchObject({
      email: "owner@example.com",
      password: "old-password",
    });
    expect(state.authRequests[1].body).toMatchObject({ password: "a-better-password" });

    // Still signed in: the page stays and the session is still stored.
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
    const stored = await page.evaluate(() => window.localStorage.getItem("sb-example-auth-token"));
    expect(stored).toContain("user-1");
  });

  test("still succeeds when the other sessions cannot be ended", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, {
      businesses: [bakery],
      authErrors: { signOutOthers: "Something went wrong" },
    });
    await page.goto("/account");

    await fillPasswordForm(page, "old-password", "a-better-password");

    await expect(
      page.getByText(
        "Password changed. We couldn’t sign out your other devices; log out and back in there.",
      ),
    ).toBeVisible();
    await expect(field(page, "New password")).toHaveValue("");
    expect(userUpdates(state)).toHaveLength(1);
    await expect(page).toHaveURL(/\/account$/);
  });

  test("a refusal from the server appears next to the field and keeps what was typed", async ({
    page,
  }) => {
    await signIn(page);
    const state = await mockApi(page, {
      businesses: [bakery],
      authErrors: { updateUser: "Password should be at least 6 characters." },
    });
    await page.goto("/account");

    await fillPasswordForm(page, "old-password", "abc");

    await expect(page.getByText("Password should be at least 6 characters.")).toBeVisible();
    await expect(field(page, "New password")).toBeFocused();
    // The verification signed in again; that must not remount the page or lose any field.
    await expect(field(page, "Current password")).toHaveValue("old-password");
    await expect(field(page, "New password")).toHaveValue("abc");
    await expect(field(page, "Repeat new password")).toHaveValue("abc");
    await expect(page.getByText("Password changed")).toHaveCount(0);
    // Nothing was changed, so the other sessions were left alone.
    expect(state.authRequests.some((request) => request.path === "/auth/v1/logout")).toBe(false);
  });

  test("an unconfirmed email can be resent and re-checked", async ({ page }) => {
    await signIn(page, { emailConfirmed: false });
    const state = await mockApi(page, { businesses: [bakery], confirmedAfterRefresh: true });
    await page.goto("/account");

    const panel = page.getByRole("region", { name: "Sign-in" });
    await expect(panel).toContainText("Email not confirmed");

    await panel.getByRole("button", { name: "Resend confirmation email" }).click();
    await expect(page.getByText("Confirmation email sent")).toBeVisible();
    const resend = state.authRequests.find((request) => request.path === "/auth/v1/resend");
    expect(resend?.body).toMatchObject({ type: "signup", email: "owner@example.com" });

    await panel.getByRole("button", { name: "I’ve confirmed it" }).click();
    await expect(page.getByText("Email confirmed").first()).toBeVisible();
    await expect(panel).toContainText("Email confirmed");
    await expect(panel.getByRole("button", { name: "Resend confirmation email" })).toHaveCount(0);
  });

  test("re-checking says so when the email is still unconfirmed", async ({ page }) => {
    await signIn(page, { emailConfirmed: false });
    await mockApi(page, { businesses: [bakery], confirmedAfterRefresh: false });
    await page.goto("/account");

    await page.getByRole("button", { name: "I’ve confirmed it" }).click();
    await expect(page.getByText("Your email isn’t confirmed yet.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sign-in" })).toContainText("Email not confirmed");
  });

  test("logs out from the page", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await page.getByRole("region", { name: "Session" }).getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(state.authRequests.some((request) => request.path === "/auth/v1/logout")).toBe(true);
  });
});

test("a password change that never reaches the server says so, not the browser's text", async ({ page }) => {
  await signIn(page);
  await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/user", (route) =>
    route.request().method() === "PUT" ? route.abort("failed") : route.fallback(),
  );
  await page.goto("/account");

  await fillPasswordForm(page, "old-password", "new-password-1");

  await expect(
    page.getByRole("alert").filter({ hasText: "Could not reach the server. Check your connection and try again." }),
  ).toBeVisible();
  await expect(page.getByText("Failed to fetch")).toHaveCount(0);
});
