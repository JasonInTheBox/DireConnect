import type { Customer } from "./types";

export const CUSTOMERS_PAGE_SIZE = 50;

export type ConsentFilter = "all" | "opted-in" | "not-opted-in";
export type EmailConsent = "opted-in" | "not-opted-in";

/**
 * The API cannot tell "never opted in" from "unsubscribed": both end with
 * `emailOptIn=false` and an `unsubscribedAt` timestamp. A customer counts as opted in
 * only with email consent and no unsubscribe, which is exactly who campaigns can reach.
 */
export function emailConsentOf(
  customer: Pick<Customer, "emailOptIn" | "unsubscribedAt">,
): EmailConsent {
  return customer.emailOptIn && !customer.unsubscribedAt ? "opted-in" : "not-opted-in";
}

export function fullName(customer: Pick<Customer, "firstName" | "lastName">): string {
  return [customer.firstName, customer.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

export function filterCustomers(
  customers: Customer[],
  query: string,
  filter: ConsentFilter,
): Customer[] {
  const needle = query.trim().toLowerCase();
  const needleDigits = digitsOf(needle);
  // Only a phone-looking query ("(555) 123", "555-0100") also searches phone digits; "ada 555" does not.
  const searchesPhone = /^[\d\s().+-]+$/.test(needle) && needleDigits.length >= 3;

  return customers.filter((customer) => {
    if (filter !== "all" && emailConsentOf(customer) !== filter) {
      return false;
    }
    if (!needle) {
      return true;
    }

    // Phone is matched by digits only below, so raw text (name and email) is all we compare here.
    const text = [fullName(customer), customer.email ?? ""].join(" ").toLowerCase();
    if (text.includes(needle)) {
      return true;
    }

    // Phone numbers are stored as typed, so compare digits only (and ignore 1-2 digit queries).
    return searchesPhone && digitsOf(customer.phone ?? "").includes(needleDigits);
  });
}

export type Page<T> = {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
};

/** `page` is clamped, so a shrinking list never leaves the view on an empty page. */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = CUSTOMERS_PAGE_SIZE,
): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);

  return {
    items: slice,
    page: current,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

export function customerCountLabel(shown: number, total: number): string {
  const noun = total === 1 ? "customer" : "customers";
  return shown === total ? `${total} ${noun}` : `${shown} of ${total} ${noun}`;
}
