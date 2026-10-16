import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const draft = campaign("k-1", "Spring menu");

test.describe("page titles", () => {
  test("every signed-in page names itself", async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true })] },
      campaigns: { b1: [draft] },
    });

    const cases: Array<[string, string]> = [
      ["/businesses", "Businesses · DireConnect"],
      ["/businesses/b1/dashboard", "Dashboard · DireConnect"],
      ["/businesses/b1/customers", "Customers · DireConnect"],
      ["/businesses/b1/campaigns", "Campaigns · DireConnect"],
      ["/businesses/b1/campaigns/new", "New campaign · DireConnect"],
      ["/businesses/b1/campaigns/k-1", "Spring menu · DireConnect"],
      ["/businesses/b1/campaigns/k-1/edit", "Edit campaign · DireConnect"],
      ["/businesses/b1/campaigns/k-1/send", "Review and send · DireConnect"],
      ["/account", "Account · DireConnect"],
    ];
    for (const [path, title] of cases) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }
  });

  test("the title follows client-side navigation", async ({ page }) => {
    await signIn(page);
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");
    await expect(page).toHaveTitle("Dashboard · DireConnect");

    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page).toHaveTitle("Customers · DireConnect");
  });

  test("the login and signup pages name themselves", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Log in · DireConnect");
    await page.goto("/signup");
    await expect(page).toHaveTitle("Create account · DireConnect");
  });
});

test("the server-rendered HTML already carries one title", async ({ request }) => {
  for (const [path, title] of [
    ["/", "DireConnect"],
    ["/login", "Log in · DireConnect"],
    ["/signup", "Create account · DireConnect"],
  ]) {
    const html = await (await request.get(path)).text();
    expect(html.match(/<title[^>]*>[^<]*<\/title>/g)).toEqual([`<title>${title}</title>`]);
  }
});

test("a loading button keeps keyboard focus and ignores a second activation", async ({ page }) => {
  await signIn(page, { emailConfirmed: false });
  const state = await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/resend", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fallback();
  });
  await page.goto("/account");

  const resend = page.getByRole("button", { name: "Resend confirmation email" });
  await resend.focus();
  await page.keyboard.press("Enter");
  await expect(resend).toHaveAttribute("aria-disabled", "true");
  await expect(resend).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Confirmation email sent")).toBeVisible();
  const resends = state.authRequests.filter((request) => request.path === "/auth/v1/resend");
  expect(resends).toHaveLength(1);
});

test("pressing Enter again in a field while a form is submitting does not submit twice", async ({ page }) => {
  const state = await mockApi(page, { businesses: [bakery] });
  await page.route("https://example.supabase.co/auth/v1/token*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fallback();
  });
  await page.goto("/login");

  await page.getByLabel("Email").fill("owner@example.com");
  const password = page.getByLabel("Password");
  await password.fill("correct horse battery");
  await password.press("Enter");
  await expect(page.getByRole("button", { name: "Log in" })).toHaveAttribute("aria-disabled", "true");
  await password.press("Enter");
  await password.press("Enter");

  await expect(page).toHaveURL(/\/businesses/);
  const logins = state.authRequests.filter((request) => request.path === "/auth/v1/token");
  expect(logins).toHaveLength(1);
});
