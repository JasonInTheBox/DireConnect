import { describe, expect, it } from "vitest";
import {
  CUSTOMERS_PAGE_SIZE,
  customerCountLabel,
  emailConsentOf,
  filterCustomers,
  fullName,
  paginate,
} from "./customers";
import type { Customer } from "./types";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    ownerId: "u1",
    businessId: "b1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "(555) 123-4567",
    emailOptIn: true,
    smsOptIn: false,
    unsubscribedAt: null,
    ...overrides,
  };
}

describe("emailConsentOf", () => {
  it("is opted in only with email consent and no unsubscribe", () => {
    expect(emailConsentOf(customer())).toBe("opted-in");
  });

  it("is not opted in without email consent", () => {
    expect(emailConsentOf(customer({ emailOptIn: false }))).toBe("not-opted-in");
  });

  it("is not opted in after an unsubscribe, even if the flag is still true", () => {
    expect(emailConsentOf(customer({ unsubscribedAt: "2026-09-01T00:00:00Z" }))).toBe(
      "not-opted-in",
    );
  });
});

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName(customer())).toBe("Ada Lovelace");
  });

  it("handles a missing or blank last name", () => {
    expect(fullName(customer({ lastName: null }))).toBe("Ada");
    expect(fullName(customer({ lastName: "   " }))).toBe("Ada");
  });
});

describe("filterCustomers", () => {
  const ada = customer();
  const grace = customer({
    id: "c2",
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace@navy.test",
    phone: "555.987.6543",
    emailOptIn: false,
    unsubscribedAt: "2026-09-01T00:00:00Z",
  });
  const all = [ada, grace];

  it("returns everyone for an empty query and the All filter", () => {
    expect(filterCustomers(all, "", "all")).toEqual(all);
    expect(filterCustomers(all, "   ", "all")).toEqual(all);
  });

  it("matches name, email and phone case-insensitively", () => {
    expect(filterCustomers(all, "HOPPER", "all")).toEqual([grace]);
    expect(filterCustomers(all, "ada@example", "all")).toEqual([ada]);
    expect(filterCustomers(all, "ada lovelace", "all")).toEqual([ada]);
  });

  it("finds a phone number regardless of the stored formatting", () => {
    expect(filterCustomers(all, "5551234", "all")).toEqual([ada]);
    expect(filterCustomers(all, "555 987", "all")).toEqual([grace]);
  });

  it("does not treat one or two digits as a phone search", () => {
    expect(filterCustomers(all, "55", "all")).toEqual([]);
  });

  it("filters by email consent", () => {
    expect(filterCustomers(all, "", "opted-in")).toEqual([ada]);
    expect(filterCustomers(all, "", "not-opted-in")).toEqual([grace]);
  });

  it("combines the query and the consent filter", () => {
    expect(filterCustomers(all, "grace", "opted-in")).toEqual([]);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, index) => index + 1);

  it("slices a page and reports the visible range", () => {
    const page = paginate(items, 3);
    expect(page.items).toHaveLength(20);
    expect(page).toMatchObject({ page: 3, pageCount: 3, total: 120, from: 101, to: 120 });
  });

  it("uses the default page size", () => {
    expect(CUSTOMERS_PAGE_SIZE).toBe(50);
    expect(paginate(items, 1).items).toHaveLength(50);
  });

  it("clamps an out-of-range page, such as after deleting the last row of the last page", () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, Number.NaN).page).toBe(1);
    expect(paginate(items.slice(0, 100), 3)).toMatchObject({ page: 2, from: 51, to: 100 });
  });

  it("handles an empty list", () => {
    expect(paginate([], 1)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      from: 0,
      to: 0,
    });
  });
});

describe("customerCountLabel", () => {
  it("shows a plain count when nothing is filtered out", () => {
    expect(customerCountLabel(42, 42)).toBe("42 customers");
    expect(customerCountLabel(1, 1)).toBe("1 customer");
    expect(customerCountLabel(0, 0)).toBe("0 customers");
  });

  it("shows shown-of-total when filtered", () => {
    expect(customerCountLabel(3, 42)).toBe("3 of 42 customers");
    expect(customerCountLabel(0, 5)).toBe("0 of 5 customers");
  });
});
