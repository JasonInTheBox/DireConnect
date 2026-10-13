import { expect, test } from "@playwright/test";
import { business, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const ada = customer("c-1", "Ada", {
  lastName: "Lovelace",
  email: "ada@example.com",
  phone: "(555) 123-4567",
  emailOptIn: true,
});
const grace = customer("c-2", "Grace", {
  lastName: "Hopper",
  email: "grace@navy.test",
  smsOptIn: true,
});
const alan = customer("c-3", "Alan", {
  lastName: "Turing",
  email: "alan@bletchley.test",
  unsubscribedAt: "2026-09-01T00:00:00Z",
});

test.describe("customers page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("lists customers with consent badges and breadcrumbs", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace, alan] } });
    await page.goto("/businesses/b1/customers");

    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).getByText("Corner Bakery"),
    ).toBeVisible();
    await expect(page.getByText("3 customers")).toBeVisible();

    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toContainText("Email opted in");
    await expect(page.getByRole("row", { name: /Grace Hopper/ })).toContainText("Email not opted in");
    await expect(page.getByRole("row", { name: /Grace Hopper/ })).toContainText("SMS opted in");
    await expect(page.getByRole("row", { name: /Alan Turing/ })).toContainText("Email not opted in");
  });

  test("searches by name and by phone digits, and filters by consent", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace, alan] } });
    await page.goto("/businesses/b1/customers");

    const search = page.getByRole("searchbox", { name: "Search customers" });
    await search.fill("hopper");
    await expect(page.getByText("1 of 3 customers")).toBeVisible();
    await expect(page.getByRole("row", { name: /Grace Hopper/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toHaveCount(0);

    await search.fill("5551234");
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Grace Hopper/ })).toHaveCount(0);

    await search.fill("");
    await page.getByLabel("Filter by consent").selectOption("opted-in");
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Alan Turing/ })).toHaveCount(0);

    await page.getByLabel("Filter by consent").selectOption("not-opted-in");
    await expect(page.getByRole("row", { name: /Grace Hopper/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Alan Turing/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toHaveCount(0);
  });

  test("a search with no results offers to clear the filters", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace] } });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("searchbox", { name: "Search customers" }).fill("zzz");
    await expect(page.getByRole("heading", { name: "No customers match your search" })).toBeVisible();
    // The "no customers yet" state must not appear while customers exist.
    await expect(page.getByRole("heading", { name: "No customers yet" })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toBeVisible();
  });

  test("an empty business invites the owner to add the first customer", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/customers");

    await expect(page.getByRole("heading", { name: "No customers yet" })).toBeVisible();
    await page.getByRole("button", { name: "Add your first customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await expect(dialog.getByLabel("First name")).toBeFocused();
  });

  test("adds a customer: validates, maps server errors, defaults consent to off", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery], customers: { b1: [ada] } });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("button", { name: "Add customer", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });

    await dialog.getByRole("button", { name: "Add customer" }).click();
    await expect(dialog.getByText("Enter a first name.")).toBeVisible();
    await expect(dialog.getByLabel("First name")).toBeFocused();

    await dialog.getByLabel("First name").fill("Katherine");
    await dialog.getByLabel("Last name").fill("Johnson");
    await dialog.getByLabel("Email", { exact: true }).fill("bad");
    await dialog.getByRole("button", { name: "Add customer" }).click();
    await expect(dialog.getByText("Invalid email")).toBeVisible();

    const consent = dialog.getByLabel("Customer explicitly agreed to receive promotional emails");
    await expect(consent).not.toBeChecked();
    await consent.check();
    await dialog.getByLabel("Email", { exact: true }).fill("kj@nasa.test");
    await dialog.getByRole("button", { name: "Add customer" }).click();

    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(page.getByRole("row", { name: /Katherine Johnson/ })).toContainText("Email opted in");

    const post = api.requests.find(
      (request) =>
        request.method === "POST" &&
        request.path === "/api/businesses/b1/customers" &&
        (request.body as { email?: string }).email === "kj@nasa.test",
    );
    expect(post?.body).toMatchObject({
      firstName: "Katherine",
      lastName: "Johnson",
      emailOptIn: true,
      smsOptIn: false,
    });
  });

  test("editing keeps the customer's existing SMS opt-in", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace] } });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("button", { name: "Actions for Grace Hopper" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit customer" });
    await expect(dialog.getByLabel("First name")).toHaveValue("Grace");
    await expect(dialog.getByText(/isn.t opted in to email right now/)).toBeVisible();

    await dialog.getByLabel("Phone").fill("555-0100");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Customer updated")).toBeVisible();
    const put = api.requests.find(
      (request) => request.method === "PUT" && request.path === "/api/businesses/b1/customers/c-2",
    );
    expect(put?.body).toMatchObject({
      firstName: "Grace",
      phone: "555-0100",
      emailOptIn: false,
      smsOptIn: true,
    });
  });

  test("deletes a customer after confirmation", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace, alan] } });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("button", { name: "Actions for Alan Turing" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Alan Turing?" });
    await dialog.getByRole("button", { name: "Delete customer" }).click();

    await expect(page.getByText("Customer deleted")).toBeVisible();
    await expect(page.getByRole("row", { name: /Alan Turing/ })).toHaveCount(0);
    await expect(page.getByText("2 customers")).toBeVisible();
  });

  test("paginates long lists", async ({ page }) => {
    const many = Array.from({ length: 120 }, (_, index) =>
      customer(`c-${index + 1}`, `Person${String(index + 1).padStart(3, "0")}`),
    );
    await mockApi(page, { businesses: [bakery], customers: { b1: many } });
    await page.goto("/businesses/b1/customers");

    await expect(page.getByText("Showing 1–50 of 120")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Showing 51–100 of 120")).toBeVisible();
    await expect(page.getByRole("row", { name: /Person051/ })).toBeVisible();
  });

  test("a failed load offers a retry", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [ada] },
      failFirstCustomersGet: true,
    });
    await page.goto("/businesses/b1/customers");

    await expect(page.getByRole("heading", { name: /Couldn.t load customers/ })).toBeVisible();
    await expect(page.getByText("Database unavailable")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("row", { name: /Ada Lovelace/ })).toBeVisible();
  });
});

test.describe("customers page on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows stacked cards instead of the table", async ({ page }) => {
    await signIn(page);
    await mockApi(page, { businesses: [bakery], customers: { b1: [ada, grace] } });
    await page.goto("/businesses/b1/customers");

    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "Ada Lovelace" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Email opted in");
    await expect(card.getByRole("button", { name: "Actions for Ada Lovelace" })).toBeVisible();
  });
});
