import { expect, test } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

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
    await expect(page.getByText("Enter a new password.")).toBeVisible();
    await expect(page.getByText("Repeat the new password.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "New password", exact: true })).toBeFocused();

    await page.getByRole("textbox", { name: "New password", exact: true }).fill("one-password");
    await page.getByRole("textbox", { name: "Repeat new password" }).fill("another-one");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("The passwords don’t match.")).toBeVisible();

    // Let the page settle so an asynchronous send could not slip past the check below.
    await page.waitForTimeout(500);
    expect(state.authRequests.some((request) => request.path === "/auth/v1/user")).toBe(false);
  });

  test("changes the password and clears the fields", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await page.getByRole("textbox", { name: "New password", exact: true }).fill("a-better-password");
    await page.getByRole("textbox", { name: "Repeat new password" }).fill("a-better-password");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "New password", exact: true })).toHaveValue("");
    await expect(page.getByRole("textbox", { name: "Repeat new password" })).toHaveValue("");

    const update = state.authRequests.find((request) => request.path === "/auth/v1/user");
    expect(update?.body).toMatchObject({ password: "a-better-password" });
  });

  test("a refusal from the server appears next to the field and keeps what was typed", async ({
    page,
  }) => {
    await signIn(page);
    await mockApi(page, {
      businesses: [bakery],
      authErrors: { updateUser: "Password should be at least 6 characters." },
    });
    await page.goto("/account");

    await page.getByRole("textbox", { name: "New password", exact: true }).fill("abc");
    await page.getByRole("textbox", { name: "Repeat new password" }).fill("abc");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByText("Password should be at least 6 characters.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "New password", exact: true })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "New password", exact: true })).toHaveValue("abc");
    await expect(page.getByText("Password changed")).toHaveCount(0);
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
