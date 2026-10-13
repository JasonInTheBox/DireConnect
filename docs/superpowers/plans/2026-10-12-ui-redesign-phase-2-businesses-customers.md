# DireConnect UI Redesign, Phase 2: Businesses and Customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Businesses and Customers pages with redesigned ones built from shared components: a business card grid with create/edit/delete, and a searchable, filterable, paginated customer table with add/edit/delete, loading/empty/error states and confirmation dialogs.

**Architecture:** Pure logic (customer filtering, consent derivation, pagination, form payloads) lives in `src/lib` and is unit-tested in Node. New primitives (Badge, Table, Pagination, PageHeader/Breadcrumbs, Select, CheckboxField, ConfirmDialog, a `dismissible` Dialog) land in `src/components/ui`. Feature components live in `src/components/business` and `src/components/customers`. The Businesses page reads the shell's shared `useBusinesses()` list (no second fetch); the Customers page uses `useApi`. Pages stay thin: fetch, then compose.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, Vitest (node environment), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (section 7 "Businesses" and "Customers"). Phase 1 (tokens, data layer, shell, auth pages) is merged on `main`; this plan builds on its exact APIs.

## Global Constraints

Carried verbatim from Phase 1, plus the rulings its final review recorded:

- Scope is `apps/web`, `e2e/`, and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts. No new dependencies.
- Light theme by default; dark follows `prefers-color-scheme`. Colours come only from the token utilities (`bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `bg-accent-soft`, `text-success`, `bg-success-soft`, `text-warning`, `bg-warning-soft`, `text-danger`, `bg-danger-soft`, `rounded-control` = 6px, `rounded-container` = 10px, `shadow-float`). No raw `gray-`/`blue-` classes.
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Touch targets: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths. Icon-only buttons need `min-h-10 min-w-10` (and `lg:min-h-9 lg:min-w-9`).
- Meaning is never conveyed by colour alone: badges and markers carry an icon or text.
- Motion only in response to a user action. **Loading indicators (spinner, skeleton pulse) are exempt** (reduced-motion disables them globally).
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- Copy: active voice, sentence case, the same verb for button and toast ("Add customer" gives "Customer added"). Errors state what happened and how to fix it; no apologies.
- **Modal convention:** inside a dialog, errors are shown inline (`FormError` or field errors). A toast is fired only as/after the dialog closes (call `toast.success(...)` immediately before `onClose()`/`onDone()`, never `toast.error` from inside a dialog). Close every modal, including the mobile drawer, before toasting.
- **Unmapped server field errors** (a validation error for a field the form does not render) must fall back to `FormError`, never be dropped.
- **Dialog dismissal:** a dialog with a request in flight must not be dismissible (Escape, backdrop, Close button).
- `useApi` (Phase 1) returns `{ data, error, loading, slow, refetch }`, scopes its state to the current path, and keeps old data visible while the same path refetches. `useBusinesses()` returns `{ businesses, status, error, slow, refetch, addBusiness }`.
- Shell layout: pages render inside `<main id="main-content">`; do not add another `<main>`. Page content uses `PageContainer` + `PageHeader` (created here), which supply the page's single `<h1>`.
- Existing e2e expectations must keep passing, except the one test this plan deliberately replaces (see Task 7).
- Work on branch `ui-redesign-phase-2`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Playwright runs modify the TRACKED `playwright-report/` and `test-results/`; restore them after each run (`git checkout -- playwright-report test-results`) and never commit them.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

## Spec deviations (decided here, from facts in the API)

- **Consent has two displayed states, not three.** The spec lists "Opted in / Not opted in / Unsubscribed". The API cannot tell "never opted in" from "unsubscribed": creating or editing a customer with no opt-ins sets `unsubscribedAt = now`, and the unsubscribe link sets `emailOptIn=false` plus `unsubscribedAt`. So a customer is **Email opted in** only when `emailOptIn && !unsubscribedAt`; every other customer is **Email not opted in**. The filter offers *All*, *Opted in to email*, *Not opted in*. Task 7 updates the spec accordingly.
- SMS is paused: customers who have `smsOptIn` get a small neutral "SMS opted in" badge; the form passes the existing `smsOptIn` through unchanged on edit and sends `false` on create.
- The customer table appears at `lg` (1024px) and above; below that the list is stacked cards. (The sidebar takes 256px, so a table at `md` would be cramped, and a table with an overflow wrapper would clip the row action menus.)

## Baseline (recorded 2026-10-12 on `main` at `b48a407`)

- `npm test`: 17 files pass, 1 fails (`apps/api/src/routes/campaign.test.ts`, `SUPABASE_JWT_SECRET`, a stale git-ignored `apps/api/src/config/env.js`; **not part of this work, do not touch**), 119 tests pass. Expected after every task: the same single failure plus all new tests passing.
- `npm run lint -w apps/web`: 0 errors, 6 warnings (react-hooks/exhaustive-deps in legacy pages). The legacy Businesses and Customers pages are rewritten here, so expect the warning count to drop to 4.
- `npx playwright test`: 18 passed.
- `tsc` may report stale `.next/types` errors until a production build has run; fix by running `NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web` once, then re-run `tsc`.
- Editor diagnostics (`71007 Props must be serializable…`, `FormEvent is deprecated`) are advisory; ignore them. Use `SyntheticEvent<HTMLFormElement>`-style types only if the existing files already do; otherwise `FormEvent` matches the codebase.

## Review Focus

Failure modes the spec implies but a happy path would miss, each pinned by a test in the owning task:

1. A delete (business or customer) in flight cannot be dismissed with Escape, and a failed delete shows its error inside the dialog instead of closing (Task 4 behaviour; Task 7 e2e for the in-flight case).
2. Editing a customer must not wipe their existing SMS opt-in, and a trimmed payload must never send whitespace-only names (Task 1 unit tests; Task 7 e2e asserts the PUT body).
3. Deleting the last row on the last page, or filtering down to fewer pages, must not leave the table on an empty out-of-range page (Task 1 `paginate` clamps; Task 6 uses the clamped page).
4. Phone numbers are stored in whatever format the owner typed: searching "5551234" must find "(555) 123-4567" (Task 1 unit test; Task 7 e2e).
5. A filter/search that hides every customer shows a "no match" state with a way to clear it, distinct from the "no customers yet" state (Task 6; Task 7 e2e).

---

### Task 1: Pure logic: customer helpers, form payloads, field-error split

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/customers.ts`, `apps/web/src/lib/customers.test.ts`
- Create: `apps/web/src/lib/customerForm.ts`, `apps/web/src/lib/customerForm.test.ts`
- Create: `apps/web/src/lib/businessForm.ts`, `apps/web/src/lib/businessForm.test.ts`
- Modify: `apps/web/src/lib/forms.ts`; Create: `apps/web/src/lib/forms.test.ts`

**Interfaces (produced):**
- `type Customer` (in `types.ts`): `{ id; ownerId; businessId; firstName: string; lastName?: string | null; email?: string | null; phone?: string | null; emailOptIn: boolean; smsOptIn: boolean; unsubscribedAt?: string | null; createdAt?: string }`
- `customers.ts`: `CUSTOMERS_PAGE_SIZE = 50`; `type ConsentFilter = "all" | "opted-in" | "not-opted-in"`; `type EmailConsent = "opted-in" | "not-opted-in"`; `emailConsentOf(c)`; `fullName(c)`; `filterCustomers(customers, query, filter)`; `type Page<T>`; `paginate(items, page, pageSize?)`; `customerCountLabel(shown, total)`
- `customerForm.ts`: `type CustomerFormValues`; `customerFormValues(customer?)`; `validateCustomerForm(values)`; `customerPayload(values, existing?)`; `needsReconsentWarning(customer?)`
- `businessForm.ts`: `type BusinessFormValues`; `businessFormValues(business?)`; `businessPayload(values)`
- `forms.ts`: `splitFieldErrors(errors, knownFields)` → `{ fields, unmapped }`

- [ ] **Step 1: Create the branch**

```bash
git switch -c ui-redesign-phase-2
git add docs/superpowers/plans/2026-10-12-ui-redesign-phase-2-businesses-customers.md
git commit -m "docs: add UI redesign phase 2 plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Add the `Customer` type**

Append to `apps/web/src/lib/types.ts`:

```ts

export type Customer = {
  id: string;
  ownerId: string;
  businessId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  unsubscribedAt?: string | null;
  createdAt?: string;
};
```

- [ ] **Step 3: Write the failing tests**

`apps/web/src/lib/customers.test.ts`:

```ts
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
```

`apps/web/src/lib/customerForm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  customerFormValues,
  customerPayload,
  needsReconsentWarning,
  validateCustomerForm,
} from "./customerForm";
import type { Customer } from "./types";

const existing: Customer = {
  id: "c1",
  ownerId: "u1",
  businessId: "b1",
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@navy.test",
  phone: null,
  emailOptIn: false,
  smsOptIn: true,
  unsubscribedAt: "2026-09-01T00:00:00Z",
};

describe("customerFormValues", () => {
  it("starts empty and opted out for a new customer", () => {
    expect(customerFormValues()).toEqual({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      emailOptIn: false,
    });
  });

  it("prefills from an existing customer, turning nulls into empty strings", () => {
    expect(customerFormValues(existing)).toEqual({
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@navy.test",
      phone: "",
      emailOptIn: false,
    });
  });
});

describe("validateCustomerForm", () => {
  const valid = customerFormValues(existing);

  it("requires a first name", () => {
    expect(validateCustomerForm({ ...valid, firstName: "" })).toEqual({
      firstName: "Enter a first name.",
    });
    expect(validateCustomerForm({ ...valid, firstName: "   " })).toEqual({
      firstName: "Enter a first name.",
    });
  });

  it("accepts a valid form", () => {
    expect(validateCustomerForm(valid)).toEqual({});
  });
});

describe("customerPayload", () => {
  const values = {
    firstName: "  Katherine ",
    lastName: " Johnson ",
    email: " kj@nasa.test ",
    phone: " 555-0100 ",
    emailOptIn: true,
  };

  it("trims every text field", () => {
    expect(customerPayload(values)).toEqual({
      firstName: "Katherine",
      lastName: "Johnson",
      email: "kj@nasa.test",
      phone: "555-0100",
      emailOptIn: true,
      smsOptIn: false,
    });
  });

  it("sends smsOptIn false for a new customer", () => {
    expect(customerPayload(values, null).smsOptIn).toBe(false);
  });

  it("preserves the existing SMS opt-in on edit instead of wiping it", () => {
    expect(customerPayload(values, existing).smsOptIn).toBe(true);
  });
});

describe("needsReconsentWarning", () => {
  it("warns for a customer who is not currently opted in", () => {
    expect(needsReconsentWarning(existing)).toBe(true);
  });

  it("does not warn for a new customer or an opted-in one", () => {
    expect(needsReconsentWarning(null)).toBe(false);
    expect(needsReconsentWarning(undefined)).toBe(false);
    expect(
      needsReconsentWarning({ ...existing, emailOptIn: true, unsubscribedAt: null }),
    ).toBe(false);
  });
});
```

`apps/web/src/lib/businessForm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { businessFormValues, businessPayload } from "./businessForm";

describe("businessFormValues", () => {
  it("starts empty", () => {
    expect(businessFormValues()).toEqual({
      name: "",
      description: "",
      email: "",
      phone: "",
      website: "",
    });
  });

  it("prefills from a business, turning nulls into empty strings", () => {
    expect(
      businessFormValues({
        id: "b1",
        ownerId: "u1",
        name: "Corner Bakery",
        description: null,
        email: "hello@bakery.test",
      }),
    ).toEqual({
      name: "Corner Bakery",
      description: "",
      email: "hello@bakery.test",
      phone: "",
      website: "",
    });
  });
});

describe("businessPayload", () => {
  it("trims every field", () => {
    expect(
      businessPayload({
        name: "  Night Market ",
        description: " Late snacks ",
        email: " a@b.co ",
        phone: " 555 ",
        website: " example.com ",
      }),
    ).toEqual({
      name: "Night Market",
      description: "Late snacks",
      email: "a@b.co",
      phone: "555",
      website: "example.com",
    });
  });
});
```

`apps/web/src/lib/forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { splitFieldErrors } from "./forms";

describe("splitFieldErrors", () => {
  it("keeps errors for fields the form renders", () => {
    expect(splitFieldErrors({ email: "Invalid email" }, ["email", "name"])).toEqual({
      fields: { email: "Invalid email" },
      unmapped: [],
    });
  });

  it("collects errors for fields the form does not render instead of dropping them", () => {
    expect(
      splitFieldErrors({ email: "Invalid email", channel: "Channel is required" }, ["email"]),
    ).toEqual({
      fields: { email: "Invalid email" },
      unmapped: ["Channel is required"],
    });
  });

  it("handles no errors", () => {
    expect(splitFieldErrors({}, ["email"])).toEqual({ fields: {}, unmapped: [] });
  });
});
```

- [ ] **Step 4: Run and confirm they fail**

Run: `npx vitest run apps/web/src/lib/customers.test.ts apps/web/src/lib/customerForm.test.ts apps/web/src/lib/businessForm.test.ts apps/web/src/lib/forms.test.ts`
Expected: FAIL (modules / `splitFieldErrors` do not exist).

- [ ] **Step 5: Implement**

`apps/web/src/lib/customers.ts`:

```ts
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

  return customers.filter((customer) => {
    if (filter !== "all" && emailConsentOf(customer) !== filter) {
      return false;
    }
    if (!needle) {
      return true;
    }

    const text = [fullName(customer), customer.email ?? "", customer.phone ?? ""]
      .join(" ")
      .toLowerCase();
    if (text.includes(needle)) {
      return true;
    }

    // Phone numbers are stored as typed, so compare digits only (and ignore 1-2 digit queries).
    return needleDigits.length >= 3 && digitsOf(customer.phone ?? "").includes(needleDigits);
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
```

`apps/web/src/lib/customerForm.ts`:

```ts
import type { Customer } from "./types";

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailOptIn: boolean;
};

export function customerFormValues(customer?: Customer | null): CustomerFormValues {
  return {
    firstName: customer?.firstName ?? "",
    lastName: customer?.lastName ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    emailOptIn: customer?.emailOptIn ?? false,
  };
}

export function validateCustomerForm(values: CustomerFormValues): Record<string, string> {
  return values.firstName.trim() ? {} : { firstName: "Enter a first name." };
}

/**
 * The API replaces every field on PUT, so SMS consent (which this form does not show while
 * SMS is paused) is passed through from the existing customer instead of being reset.
 */
export function customerPayload(
  values: CustomerFormValues,
  existing?: Pick<Customer, "smsOptIn"> | null,
) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    emailOptIn: values.emailOptIn,
    smsOptIn: existing?.smsOptIn ?? false,
  };
}

/** Ticking consent on someone who is not currently opted in re-subscribes them. */
export function needsReconsentWarning(customer?: Customer | null): boolean {
  return Boolean(customer && !(customer.emailOptIn && !customer.unsubscribedAt));
}
```

`apps/web/src/lib/businessForm.ts`:

```ts
import type { Business } from "./types";

export type BusinessFormValues = {
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
};

export function businessFormValues(business?: Business | null): BusinessFormValues {
  return {
    name: business?.name ?? "",
    description: business?.description ?? "",
    email: business?.email ?? "",
    phone: business?.phone ?? "",
    website: business?.website ?? "",
  };
}

export function businessPayload(values: BusinessFormValues): BusinessFormValues {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    website: values.website.trim(),
  };
}
```

Append to `apps/web/src/lib/forms.ts`:

```ts

/**
 * Splits server field errors into those a form renders and the rest, so an error for a
 * field the form does not show is surfaced (as a form-level message) and never dropped.
 */
export function splitFieldErrors(
  errors: Record<string, string>,
  knownFields: readonly string[],
): { fields: Record<string, string>; unmapped: string[] } {
  const fields: Record<string, string> = {};
  const unmapped: string[] = [];

  for (const [field, message] of Object.entries(errors)) {
    if (knownFields.includes(field)) {
      fields[field] = message;
    } else {
      unmapped.push(message);
    }
  }

  return { fields, unmapped };
}
```

- [ ] **Step 6: Run and confirm they pass**

Run: `npx vitest run apps/web/src/lib`
Expected: PASS for every file under `apps/web/src/lib` (the new four plus the Phase 1 files).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): add customer, business-form and field-error helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Display primitives: icons, Badge, Table, Pagination, PageHeader, ListSkeleton

**Files:**
- Modify: `apps/web/src/components/ui/icons.tsx`, `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`, `table.tsx`, `pagination.tsx`, `page-header.tsx`

**Interfaces (produced):**
- `IconName` gains `"more" | "search" | "edit" | "trash" | "minus" | "chevronLeft" | "chevronRight"`.
- `Badge({ tone?: "neutral" | "success" | "warning" | "danger" | "accent"; icon?: IconName; children })`
- `Table({ caption: string; children })`, `THead`, `TBody`, `Tr`, `Th({ className? })`, `Td({ className? })` (children typed `ReactNode`)
- `Pagination({ page, pageCount, from, to, total, onPageChange })` (renders nothing when `pageCount <= 1`)
- `Crumb = { label: string; href?: string }`; `Breadcrumbs({ items })`; `PageHeader({ title, description?, breadcrumbs?, actions? })`; `PageContainer({ children })`
- `ListSkeleton({ rows?: number; slow?: boolean })`

No unit tests (Node-only Vitest, no DOM); verification is type-check, lint, and the Task 7 e2e tests.

- [ ] **Step 1: Extend the icon set**

In `apps/web/src/components/ui/icons.tsx`, add these entries to the `PATHS` object (before the closing `} as const;`):

```ts
  more: "M12 5h.01M12 12h.01M12 19h.01",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  minus: "M5 12h14",
  chevronLeft: "M15 18l-6-6 6-6",
  chevronRight: "M9 18l6-6-6-6",
```

- [ ] **Step 2: `badge.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
};

/** A short status label. Always give it an icon or meaningful text: colour is never the only signal. */
export function Badge({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-control px-2 py-0.5 text-xs font-medium",
        TONES[tone],
      )}
    >
      {icon ? <Icon name={icon} className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 3: `table.tsx`**

The wrapper deliberately has no `overflow` so row action menus (absolutely positioned) are not clipped.

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="rounded-container border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-sunken text-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-sunken">{children}</tr>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 font-medium first:rounded-tl-[9px] last:rounded-tr-[9px]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-t border-line px-4 py-3 align-middle", className)}>{children}</td>;
}
```

- [ ] **Step 4: `pagination.tsx`**

```tsx
import { Button } from "./button";
import { Icon } from "./icons";

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <p className="text-[13px] text-muted">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <Icon name="chevronLeft" />
          Previous
        </Button>
        <Button size="sm" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
          <Icon name="chevronRight" />
        </Button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: `page-header.tsx`**

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <Icon name="chevronRight" className="h-3 w-3" /> : null}
            {item.href ? (
              <Link href={item.href} className="truncate hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The page's single <h1>, with optional breadcrumbs above and primary actions on the right. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 space-y-3">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>;
}
```

- [ ] **Step 6: `ListSkeleton` in `skeleton.tsx`**

Append to `apps/web/src/components/ui/skeleton.tsx`:

```tsx

export function ListSkeleton({ rows = 6, slow = false }: { rows?: number; slow?: boolean }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
      {slow ? <SlowNotice /> : null}
    </div>
  );
}
```

(`Skeleton` and `SlowNotice` are already imported/defined in that file; `SlowNotice` is imported from `./state`.)

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; lint 0 errors, no new warnings.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): add Badge, Table, Pagination, PageHeader and list skeleton" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Form controls: Select and CheckboxField

**Files:**
- Create: `apps/web/src/components/ui/select.tsx`, `apps/web/src/components/ui/checkbox.tsx`

**Interfaces (produced):**
- `Select({ label: string; hideLabel?: boolean; options: Array<{ value: string; label: string }>; ...SelectHTMLAttributes })`: native `<select>` with a visible (or screen-reader-only) label.
- `CheckboxField({ label: string; hint?: string; ...InputHTMLAttributes (no type) })`: the whole row is the click target (at least 40px), the hint is linked with `aria-describedby`.

- [ ] **Step 1: `select.tsx`**

```tsx
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type Option = { value: string; label: string };

export function Select({
  label,
  hideLabel = false,
  options,
  id,
  className,
  ...props
}: {
  label: string;
  /** Keep the label for screen readers but do not show it (toolbar filters). */
  hideLabel?: boolean;
  options: Option[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className={hideLabel ? "sr-only" : "block text-[13px] font-medium text-ink"}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "block h-10 w-full appearance-none rounded-control border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink lg:h-9",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevrons"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `checkbox.tsx`**

```tsx
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function CheckboxField({
  label,
  hint,
  id,
  className,
  ...props
}: {
  label: string;
  hint?: string;
  id?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id">) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="flex min-h-10 cursor-pointer items-start gap-3 rounded-control py-2 text-sm font-medium text-ink"
      >
        <input
          id={fieldId}
          type="checkbox"
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent", className)}
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={`${fieldId}-hint`} className="pl-8 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; no new lint warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/select.tsx apps/web/src/components/ui/checkbox.tsx
git commit -m "feat(web): add Select and CheckboxField" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dialog `dismissible` and ConfirmDialog

**Files:**
- Modify: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/confirm-dialog.tsx`

**Interfaces:**
- Consumes: `Dialog`, `Button`, `TextField`, `FormError`, `ApiError`.
- Produces:
  - `Dialog` gains `dismissible?: boolean` (default `true`). While `false`, Escape, backdrop click and the Close button do nothing, and a browser-forced close re-opens the dialog. Escape is now handled through the `cancel` event, so `open` stays the single source of truth.
  - `ConfirmDialog({ open; onClose; title; description; confirmLabel; confirmText?; onConfirm: () => Promise<void> })`. `onConfirm` does the work and, on success, fires its own success toast as its last statement; it throws to keep the dialog open and show the message inline. The dialog is not dismissible while `onConfirm` is running. With `confirmText`, the confirm button stays disabled until that exact text is typed.

- [ ] **Step 1: Make `Dialog` dismissible-aware**

In `apps/web/src/components/ui/dialog.tsx`:

1. Add `dismissible?: boolean;` to `DialogProps` (after `hideTitle`), with the doc comment `/** When false (a request is in flight) Escape, the backdrop and the Close button do nothing. */`, and add `dismissible = true,` to the destructured props.
2. Replace the `<dialog …>` event handlers `onClose`, `onPointerDown`, `onClick` with:

```tsx
      // Handle Escape ourselves so `open` stays the single source of truth.
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) {
          onClose();
        }
      }}
      // Fires after element.close(). Only act on closes we did not ask for, such as a
      // browser force-closing on a repeated Escape.
      onClose={() => {
        if (!open) {
          return;
        }
        if (dismissible) {
          onClose();
        } else {
          ref.current?.showModal();
        }
      }}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Close only when both the press and the release landed on the backdrop itself,
        // so a drag that starts inside the content and ends outside does not dismiss.
        const startedOnBackdrop = pointerDownOnBackdrop.current;
        pointerDownOnBackdrop.current = false;
        if (dismissible && startedOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
```

3. On the header Close `<button>`, add `disabled={!dismissible}` and append `disabled:pointer-events-none disabled:opacity-50` to its `className`.

Leave everything else (scroll lock, `data-autofocus`, drawer placement, sizing classes) as it is.

- [ ] **Step 2: `confirm-dialog.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/apiClient";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { TextField } from "./field";
import { FormError } from "./state";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Require this exact text to be typed before the action is enabled. */
  confirmText?: string;
  /**
   * Runs the action. Throw to keep the dialog open and show the message inline. On success,
   * fire the success toast as the last statement; the dialog closes right after it returns.
   */
  onConfirm: () => Promise<void>;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
      dismissible={!busy}
    >
      <ConfirmForm {...props} onBusyChange={setBusy} />
    </Dialog>
  );
}

function ConfirmForm({
  onClose,
  confirmLabel,
  confirmText,
  onConfirm,
  onBusyChange,
}: ConfirmDialogProps & { onBusyChange: (busy: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const matches = confirmText === undefined || typed.trim() === confirmText.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) {
      return;
    }

    setError(null);
    setPending(true);
    onBusyChange(true);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {confirmText !== undefined ? (
        <TextField
          label={`Type “${confirmText}” to confirm`}
          data-autofocus="true"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      ) : null}

      {error ? <FormError message={error} /> : null}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={pending}
          data-autofocus={confirmText === undefined ? "true" : undefined}
        >
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={pending} disabled={!matches}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Type-check, lint, and re-run the existing e2e shell tests**

The Dialog change affects the Phase 1 create dialog and the mobile drawer (Escape handling), so run them:

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
npx playwright test e2e/shell.spec.ts
git checkout -- playwright-report test-results
```

Expected: no TypeScript errors; lint 0 errors, no new warnings; all 11 shell tests pass (including "navigation opens in a drawer that closes with Escape", "Escape closes the business menu inside the drawer before the drawer", and "creating a business validates, saves and opens its dashboard").

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/confirm-dialog.tsx
git commit -m "feat(web): add dismissible dialogs and a confirm dialog" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Businesses page: form dialog, card, page

**Files:**
- Rename + rewrite: `apps/web/src/components/shell/create-business-dialog.tsx` → `apps/web/src/components/shell/business-form-dialog.tsx`
- Modify: `apps/web/src/components/shell/business-switcher.tsx`
- Create: `apps/web/src/components/business/business-card.tsx`
- Rewrite: `apps/web/src/app/(app)/businesses/page.tsx`

**Interfaces:**
- Consumes: Task 1 (`businessFormValues`, `businessPayload`, `splitFieldErrors`), Task 2 (`PageContainer`, `PageHeader`, `ListSkeleton`), Task 4 (`ConfirmDialog`, `Dialog dismissible`), Phase 1 (`useBusinesses`, `apiFetch`, `Monogram`, `Menu`, `useToast`).
- Produces: `BusinessFormDialog({ open, onClose, business?: Business | null })`: create mode when `business` is null/omitted (title "Create a business", button "Create business"), edit mode otherwise (title "Edit business", button "Save changes"); `BusinessCard({ business, onEdit, onDelete })`.

- [ ] **Step 1: Rename the dialog file**

```bash
git mv apps/web/src/components/shell/create-business-dialog.tsx apps/web/src/components/shell/business-form-dialog.tsx
```
(If `git mv` fails with "Permission denied" on Windows, create the new file, `git rm` the old one.)

- [ ] **Step 2: Rewrite `business-form-dialog.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import { businessFormValues, businessPayload, type BusinessFormValues } from "@/lib/businessForm";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Business } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useBusinesses } from "./businesses-provider";

const FIELDS = ["name", "description", "email", "phone", "website"] as const;

type BusinessFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Edit this business. Omit (or pass null) to create a new one. */
  business?: Business | null;
};

export function BusinessFormDialog({ open, onClose, business = null }: BusinessFormDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={business ? "Edit business" : "Create a business"}
      description={business ? undefined : "Each business has its own customers and campaigns."}
      dismissible={!busy}
    >
      <BusinessForm business={business} onDone={onClose} onBusyChange={setBusy} />
    </Dialog>
  );
}

function BusinessForm({
  business,
  onDone,
  onBusyChange,
}: {
  business: Business | null;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { addBusiness, refetch } = useBusinesses();
  const [values, setValues] = useState<BusinessFormValues>(() => businessFormValues(business));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof BusinessFormValues) {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setFormError(null);
    if (!values.name.trim()) {
      setErrors({ name: "Enter a business name." });
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    onBusyChange(true);
    try {
      const payload = businessPayload(values);
      if (business) {
        await apiFetch<Business>(`/api/businesses/${business.id}`, {
          method: "PUT",
          body: payload,
        });
        refetch();
        toast.success("Business updated");
        onDone();
      } else {
        const created = await apiFetch<Business>("/api/businesses", {
          method: "POST",
          body: payload,
        });
        addBusiness(created);
        toast.success("Business created");
        onDone();
        router.push(`/businesses/${created.id}/dashboard`);
      }
    } catch (error) {
      const { fields, unmapped } = splitFieldErrors(fieldErrorsFromApiError(error), FIELDS);
      const hasFieldErrors = Object.keys(fields).length > 0;

      if (hasFieldErrors) {
        setErrors(fields);
        focusFirstInvalid(form);
      }
      if (unmapped.length > 0) {
        setFormError(unmapped.join(" "));
      } else if (!hasFieldErrors) {
        setFormError(
          error instanceof ApiError ? error.message : "Could not save the business. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Business name"
        required
        // React autoFocus fires while the native dialog is still closed; Dialog focuses [data-autofocus] after showModal().
        data-autofocus="true"
        autoComplete="organization"
        value={values.name}
        onChange={update("name")}
        error={errors.name}
      />
      <TextAreaField
        label="Description"
        hint="Optional. A line about what the business does."
        value={values.description}
        onChange={update("description")}
        error={errors.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={update("phone")}
          error={errors.phone}
        />
      </div>
      <TextField
        label="Website"
        placeholder="example.com"
        autoComplete="url"
        value={values.website}
        onChange={update("website")}
        error={errors.website}
      />

      {formError ? <FormError message={formError} /> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {business ? "Save changes" : "Create business"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Point the switcher at the new dialog**

In `apps/web/src/components/shell/business-switcher.tsx` replace the import `import { CreateBusinessDialog } from "./create-business-dialog";` with `import { BusinessFormDialog } from "./business-form-dialog";` and the JSX `<CreateBusinessDialog open={creating} onClose={() => setCreating(false)} />` with `<BusinessFormDialog open={creating} onClose={() => setCreating(false)} />`.

- [ ] **Step 4: `business-card.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Monogram } from "@/components/shell/monogram";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import type { Business } from "@/lib/types";

export function BusinessCard({
  business,
  onEdit,
  onDelete,
}: {
  business: Business;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const contact = [business.email, business.phone, business.website].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <li className="flex flex-col rounded-container border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <Monogram name={business.name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-ink" title={business.name}>
            {business.name}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {business.description || "No description yet."}
          </p>
        </div>
        <Menu
          align="end"
          items={[
            { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: onEdit },
            { id: "delete", label: "Delete", icon: <Icon name="trash" />, onSelect: onDelete },
          ]}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              aria-label={`Actions for ${business.name}`}
              className="-mr-2 -mt-1 flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
            >
              <Icon name="more" />
            </button>
          )}
        />
      </div>

      {contact.length > 0 ? (
        <ul className="mt-4 space-y-1 text-[13px] text-muted">
          {contact.map((item) => (
            <li key={item} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        <Link
          href={`/businesses/${business.id}/dashboard`}
          aria-label={`Open ${business.name}`}
          className={buttonClasses({ variant: "secondary" })}
        >
          Open
        </Link>
      </div>
    </li>
  );
}
```

- [ ] **Step 5: Rewrite the Businesses page**

Replace the entire contents of `apps/web/src/app/(app)/businesses/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { BusinessCard } from "@/components/business/business-card";
import { BusinessFormDialog } from "@/components/shell/business-form-dialog";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import type { Business } from "@/lib/types";

export default function BusinessesPage() {
  const { businesses, status, error, slow, refetch } = useBusinesses();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title="Businesses"
        description="Each business has its own customers and campaigns."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            New business
          </Button>
        }
      />

      {status === "loading" ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : status === "error" ? (
        <ErrorState
          title="Couldn’t load your businesses"
          message={error?.message ?? "Try again in a moment."}
          onRetry={refetch}
        />
      ) : businesses.length === 0 ? (
        <EmptyState
          title="Create your first business"
          description="Add the business you want to keep in touch with customers for. You can add more later."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create business
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onEdit={() => setEditing(business)}
              onDelete={() => setDeleting(business)}
            />
          ))}
        </ul>
      )}

      <BusinessFormDialog open={creating} onClose={() => setCreating(false)} />
      <BusinessFormDialog
        open={editing !== null}
        business={editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this business"}?`}
        description="This permanently deletes the business along with its customers and campaigns. This can’t be undone."
        confirmLabel="Delete business"
        confirmText={deleting?.name}
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${deleting.id}`, { method: "DELETE" });
          refetch();
          toast.success("Business deleted");
        }}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 6: Type-check, lint, build**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
```

Expected: no TypeScript errors (if only stale `.next/types` errors appear, the build clears them; re-run tsc); lint 0 errors and the legacy Businesses page's warning gone; the build succeeds with the same route table.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): redesign the Businesses page with create, edit and delete" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Customers page: form dialog, table, toolbar, page

**Files (all new unless noted), under `apps/web/src/`:**
- `components/customers/customer-form-dialog.tsx`
- `components/customers/customer-table.tsx` (exports `CustomerTable`; contains `ConsentBadges` and the row actions)
- `components/customers/customers-toolbar.tsx`
- Rewrite: `app/(app)/businesses/[businessId]/customers/page.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2/3/4 primitives, Phase 1 `useApi`, `useBusinesses`, `Menu`, `useToast`.
- Produces: `CustomerFormDialog({ open; onClose; businessId; customer?: Customer | null; onSaved: () => void })`; `CustomerTable({ customers; onEdit(customer); onDelete(customer) })`; `CustomersToolbar({ query; onQueryChange; filter; onFilterChange; countLabel })`.

- [ ] **Step 1: `customer-form-dialog.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import {
  customerFormValues,
  customerPayload,
  needsReconsentWarning,
  validateCustomerForm,
  type CustomerFormValues,
} from "@/lib/customerForm";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";

const FIELDS = ["firstName", "lastName", "email", "phone"] as const;

type CustomerFormDialogProps = {
  open: boolean;
  onClose: () => void;
  businessId: string;
  /** Edit this customer. Omit (or pass null) to add a new one. */
  customer?: Customer | null;
  onSaved: () => void;
};

export function CustomerFormDialog({
  open,
  onClose,
  businessId,
  customer = null,
  onSaved,
}: CustomerFormDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      description={customer ? undefined : "Add someone you want to keep in touch with."}
      dismissible={!busy}
    >
      <CustomerForm
        businessId={businessId}
        customer={customer}
        onSaved={onSaved}
        onDone={onClose}
        onBusyChange={setBusy}
      />
    </Dialog>
  );
}

function CustomerForm({
  businessId,
  customer,
  onSaved,
  onDone,
  onBusyChange,
}: {
  businessId: string;
  customer: Customer | null;
  onSaved: () => void;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<CustomerFormValues>(() => customerFormValues(customer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: "firstName" | "lastName" | "email" | "phone") {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setFormError(null);
    const clientErrors = validateCustomerForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    onBusyChange(true);
    try {
      const base = `/api/businesses/${businessId}/customers`;
      await apiFetch<Customer>(customer ? `${base}/${customer.id}` : base, {
        method: customer ? "PUT" : "POST",
        body: customerPayload(values, customer),
      });
      onSaved();
      toast.success(customer ? "Customer updated" : "Customer added");
      onDone();
    } catch (error) {
      const { fields, unmapped } = splitFieldErrors(fieldErrorsFromApiError(error), FIELDS);
      const hasFieldErrors = Object.keys(fields).length > 0;

      if (hasFieldErrors) {
        setErrors(fields);
        focusFirstInvalid(form);
      }
      if (unmapped.length > 0) {
        setFormError(unmapped.join(" "));
      } else if (!hasFieldErrors) {
        setFormError(
          error instanceof ApiError ? error.message : "Could not save the customer. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          required
          // React autoFocus fires while the native dialog is still closed; Dialog focuses [data-autofocus] after showModal().
          data-autofocus="true"
          autoComplete="off"
          value={values.firstName}
          onChange={update("firstName")}
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          autoComplete="off"
          value={values.lastName}
          onChange={update("lastName")}
          error={errors.lastName}
        />
      </div>
      <TextField
        label="Email"
        type="email"
        autoComplete="off"
        value={values.email}
        onChange={update("email")}
        error={errors.email}
      />
      <TextField
        label="Phone"
        type="tel"
        autoComplete="off"
        value={values.phone}
        onChange={update("phone")}
        error={errors.phone}
      />
      <CheckboxField
        label="Customer explicitly agreed to receive promotional emails"
        hint={
          needsReconsentWarning(customer)
            ? "This customer isn’t opted in to email right now (they may have unsubscribed). Only turn this on if they’ve told you they want to hear from you."
            : "Only customers who agreed can receive your email campaigns."
        }
        checked={values.emailOptIn}
        onChange={(event) =>
          setValues((previous) => ({ ...previous, emailOptIn: event.target.checked }))
        }
      />

      {formError ? <FormError message={formError} /> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {customer ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: `customer-table.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { emailConsentOf, fullName } from "@/lib/customers";
import type { Customer } from "@/lib/types";

type Handlers = {
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ConsentBadges({ customer }: { customer: Customer }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {emailConsentOf(customer) === "opted-in" ? (
        <Badge tone="success" icon="check">
          Email opted in
        </Badge>
      ) : (
        <Badge icon="minus">Email not opted in</Badge>
      )}
      {customer.smsOptIn ? <Badge icon="check">SMS opted in</Badge> : null}
    </span>
  );
}

function RowActions({ customer, onEdit, onDelete }: { customer: Customer } & Handlers) {
  const name = fullName(customer);

  return (
    <Menu
      align="end"
      items={[
        { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: () => onEdit(customer) },
        {
          id: "delete",
          label: "Delete",
          icon: <Icon name="trash" />,
          onSelect: () => onDelete(customer),
        },
      ]}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`Actions for ${name}`}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
        >
          <Icon name="more" />
        </button>
      )}
    />
  );
}

function Truncated({ children }: { children: ReactNode }) {
  return <div className="max-w-[16rem] truncate">{children}</div>;
}

/** A table from `lg` up; stacked cards below, where a table would be cramped. */
export function CustomerTable({
  customers,
  onEdit,
  onDelete,
}: { customers: Customer[] } & Handlers) {
  return (
    <>
      <div className="hidden lg:block">
        <Table caption="Customers">
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Consent</Th>
              <Th className="w-14">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {customers.map((customer) => (
              <Tr key={customer.id}>
                <Td className="font-medium text-ink">
                  <Truncated>{fullName(customer)}</Truncated>
                </Td>
                <Td>
                  <Truncated>{customer.email || <Missing label="No email" />}</Truncated>
                </Td>
                <Td>
                  <Truncated>{customer.phone || <Missing label="No phone" />}</Truncated>
                </Td>
                <Td>
                  <ConsentBadges customer={customer} />
                </Td>
                <Td className="text-right">
                  <RowActions customer={customer} onEdit={onEdit} onDelete={onDelete} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="space-y-2 lg:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className="rounded-container border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="truncate text-sm font-medium text-ink">{fullName(customer)}</p>
                <ConsentBadges customer={customer} />
              </div>
              <div className="-mr-2 -mt-2">
                <RowActions customer={customer} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-[13px] text-muted">
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd className="truncate">{customer.email || <Missing label="No email" />}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd className="truncate">{customer.phone || <Missing label="No phone" />}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 3: `customers-toolbar.tsx`**

```tsx
"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import type { ConsentFilter } from "@/lib/customers";

const FILTER_OPTIONS: Array<{ value: ConsentFilter; label: string }> = [
  { value: "all", label: "All customers" },
  { value: "opted-in", label: "Opted in to email" },
  { value: "not-opted-in", label: "Not opted in" },
];

export function CustomersToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  countLabel,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  filter: ConsentFilter;
  onFilterChange: (filter: ConsentFilter) => void;
  countLabel: string;
}) {
  const searchId = useId();

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search customers
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, email or phone"
            className="block h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted lg:h-9"
          />
        </div>
        <div className="sm:w-56">
          <Select
            label="Filter by consent"
            hideLabel
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as ConsentFilter)}
            options={FILTER_OPTIONS}
          />
        </div>
      </div>
      <p aria-live="polite" className="text-[13px] text-muted">
        {countLabel}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the Customers page**

Replace the entire contents of `apps/web/src/app/(app)/businesses/[businessId]/customers/page.tsx` with:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import {
  customerCountLabel,
  filterCustomers,
  fullName,
  paginate,
  type ConsentFilter,
} from "@/lib/customers";
import type { Customer } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CustomersPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so search, filter, page and open dialogs reset when the business changes.
  return <CustomersView key={businessId} businessId={businessId} />;
}

function CustomersView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const toast = useToast();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const { data, error, slow, refetch } = useApi<Customer[]>(
    `/api/businesses/${businessId}/customers`,
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConsentFilter>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const customers = data ?? [];
  const filtered = filterCustomers(customers, query, filter);
  const visible = paginate(filtered, page);

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function changeFilter(next: ConsentFilter) {
    setFilter(next);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setPage(1);
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Customers" },
        ]}
        title="Customers"
        description="The people you keep in touch with. Only customers who agreed to receive emails are included in campaigns."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            Add customer
          </Button>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load customers" message={error.message} onRetry={refetch} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon="users"
          title="No customers yet"
          description="Add the people you want to keep in touch with. Only customers who agreed to receive emails will get your campaigns."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Add your first customer
            </Button>
          }
        />
      ) : (
        <>
          <CustomersToolbar
            query={query}
            onQueryChange={changeQuery}
            filter={filter}
            onFilterChange={changeFilter}
            countLabel={customerCountLabel(filtered.length, customers.length)}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title="No customers match your search"
              description="Try a different name, email or phone number."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <>
              <CustomerTable customers={visible.items} onEdit={setEditing} onDelete={setDeleting} />
              <Pagination
                page={visible.page}
                pageCount={visible.pageCount}
                from={visible.from}
                to={visible.to}
                total={visible.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      <CustomerFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        businessId={businessId}
        onSaved={refetch}
      />
      <CustomerFormDialog
        open={editing !== null}
        customer={editing}
        onClose={() => setEditing(null)}
        businessId={businessId}
        onSaved={refetch}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting ? fullName(deleting) : "this customer"}?`}
        description="This removes the customer from this business. This can’t be undone."
        confirmLabel="Delete customer"
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${businessId}/customers/${deleting.id}`, {
            method: "DELETE",
          });
          refetch();
          toast.success("Customer deleted");
        }}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 5: Type-check, lint, build**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
```

Expected: no TypeScript errors (re-run tsc after the build if only stale `.next/types` errors appear); lint 0 errors, the legacy Customers page's warning gone (4 legacy warnings remain); the build succeeds with the same route table.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): redesign the Customers page with search, filter, pagination and CRUD" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end tests, spec update and final verification

**Files:**
- Rewrite: `e2e/helpers/app.ts`
- Modify: `e2e/shell.spec.ts` (remove one legacy-page test)
- Create: `e2e/businesses.spec.ts`, `e2e/customers.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`

**Interfaces:**
- Produces from `e2e/helpers/app.ts` (existing exports `API`, `MockBusiness`, `business`, `signIn`, `mockApi` keep their meaning): `MockCustomer`, `customer(id, firstName, overrides?, businessId?)`, `RecordedRequest`; `mockApi` now also takes `customers?: Record<string, MockCustomer[]>`, `delayWritesMs?`, `failFirstCustomersGet?`, and its returned state exposes `businesses`, `customers`, `requests`.

- [ ] **Step 1: Replace `e2e/helpers/app.ts`**

```ts
import type { Page, Route } from "@playwright/test";

export const API = "http://localhost:4000";

export type MockBusiness = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
};

export function business(id: string, name: string): MockBusiness {
  return { id, ownerId: "user-1", name, description: null, email: null, phone: null, website: null };
}

export type MockCustomer = {
  id: string;
  ownerId: string;
  businessId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  unsubscribedAt: string | null;
};

export function customer(
  id: string,
  firstName: string,
  overrides: Partial<MockCustomer> = {},
  businessId = "b1",
): MockCustomer {
  return {
    id,
    ownerId: "user-1",
    businessId,
    firstName,
    lastName: null,
    email: null,
    phone: null,
    emailOptIn: false,
    smsOptIn: false,
    unsubscribedAt: null,
    ...overrides,
  };
}

/** Seeds a signed-in Supabase session; the client reads it locally and does not verify it. */
export async function signIn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "sb-example-auth-token",
      JSON.stringify({
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 86_400,
        expires_at: Math.floor(Date.now() / 1000) + 86_400,
        user: {
          id: "user-1",
          aud: "authenticated",
          email: "owner@example.com",
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    );
  });
}

export type RecordedRequest = { method: string; path: string; body: unknown };

type ApiMockOptions = {
  businesses: MockBusiness[];
  /** Customers per business id. */
  customers?: Record<string, MockCustomer[]>;
  /** Delays every non-preflight API response, to simulate a sleeping server. */
  delayMs?: number;
  /** Delays only writes (POST/PUT/DELETE), to hold a request in flight. */
  delayWritesMs?: number;
  /** Makes the first customers list request fail with a 500. */
  failFirstCustomersGet?: boolean;
};

function emptyDashboard(target: MockBusiness) {
  return {
    business: target,
    summary: {
      customers: { total: 0, emailOptedIn: 0, smsOptedIn: 0, unsubscribed: 0 },
      campaigns: { total: 0, draft: 0, queued: 0, sent: 0, failed: 0 },
      messages: { totalLogs: 0, sent: 0, failed: 0, pending: 0, successRate: null },
    },
    recentCampaigns: [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockApi(page: Page, options: ApiMockOptions) {
  const state = {
    businesses: [...options.businesses],
    customers: Object.fromEntries(
      Object.entries(options.customers ?? {}).map(([id, list]) => [id, [...list]]),
    ) as Record<string, MockCustomer[]>,
    created: [] as Array<Record<string, unknown>>,
    requests: [] as RecordedRequest[],
    nextCustomerId: 1000,
    customersGetFailed: false,
  };

  // The Supabase client may try to reach its (fake) host; keep it quiet and offline.
  await page.route("https://example.supabase.co/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
  );

  await page.route(`${API}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization,content-type",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });
    const noContent = () => route.fulfill({ status: 204, headers: cors });

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }

    const rawBody = request.postData();
    const body = (rawBody ? JSON.parse(rawBody) : undefined) as Record<string, unknown> | undefined;
    state.requests.push({ method: request.method(), path: url.pathname, body });

    if (options.delayMs) {
      await sleep(options.delayMs);
    }
    if (options.delayWritesMs && request.method() !== "GET") {
      await sleep(options.delayWritesMs);
    }

    if (url.pathname === "/health") {
      return json(200, { status: "ok" });
    }

    if (url.pathname === "/api/businesses" && request.method() === "GET") {
      return json(200, state.businesses);
    }

    if (url.pathname === "/api/businesses" && request.method() === "POST") {
      if (body?.email === "bad") {
        return json(400, {
          error: "Invalid request body",
          details: [{ path: ["email"], message: "Invalid email" }],
        });
      }
      state.created.push(body ?? {});
      const created = business(`new-${state.created.length}`, String(body?.name));
      state.businesses.push(created);
      return json(201, created);
    }

    const businessRoute = url.pathname.match(/^\/api\/businesses\/([^/]+)$/);
    if (businessRoute && request.method() === "PUT") {
      const index = state.businesses.findIndex((candidate) => candidate.id === businessRoute[1]);
      if (index === -1) {
        return json(404, { error: "Business not found" });
      }
      const updated = { ...state.businesses[index], ...body } as MockBusiness;
      state.businesses[index] = updated;
      return json(200, updated);
    }
    if (businessRoute && request.method() === "DELETE") {
      state.businesses = state.businesses.filter((candidate) => candidate.id !== businessRoute[1]);
      return noContent();
    }

    const dashboard = url.pathname.match(/^\/api\/businesses\/([^/]+)\/dashboard$/);
    if (dashboard) {
      const match = state.businesses.find((candidate) => candidate.id === dashboard[1]);
      return match ? json(200, emptyDashboard(match)) : json(404, { error: "Business not found" });
    }

    const customerRoute = url.pathname.match(/^\/api\/businesses\/([^/]+)\/customers(?:\/([^/]+))?$/);
    if (customerRoute) {
      const [, businessId, customerId] = customerRoute;
      const list = (state.customers[businessId] ??= []);

      if (request.method() === "GET" && !customerId) {
        if (options.failFirstCustomersGet && !state.customersGetFailed) {
          state.customersGetFailed = true;
          return json(500, { error: "Database unavailable" });
        }
        return json(200, list);
      }

      if (request.method() === "POST" && !customerId) {
        if (body?.email === "bad") {
          return json(400, {
            error: "Invalid request body",
            details: [{ path: ["email"], message: "Invalid email" }],
          });
        }
        const subscribed = Boolean(body?.emailOptIn) || Boolean(body?.smsOptIn);
        const created = customer(
          `c-${state.nextCustomerId++}`,
          String(body?.firstName),
          {
            lastName: (body?.lastName as string) || null,
            email: (body?.email as string) || null,
            phone: (body?.phone as string) || null,
            emailOptIn: Boolean(body?.emailOptIn),
            smsOptIn: Boolean(body?.smsOptIn),
            // Mirrors the API: no opt-in at all is stored as unsubscribed.
            unsubscribedAt: subscribed ? null : new Date().toISOString(),
          },
          businessId,
        );
        list.unshift(created);
        return json(201, created);
      }

      if (request.method() === "PUT" && customerId) {
        const index = list.findIndex((candidate) => candidate.id === customerId);
        if (index === -1) {
          return json(404, { error: "Customer not found" });
        }
        const subscribed = Boolean(body?.emailOptIn) || Boolean(body?.smsOptIn);
        const updated: MockCustomer = {
          ...list[index],
          firstName: String(body?.firstName),
          lastName: (body?.lastName as string) || null,
          email: (body?.email as string) || null,
          phone: (body?.phone as string) || null,
          emailOptIn: Boolean(body?.emailOptIn),
          smsOptIn: Boolean(body?.smsOptIn),
          unsubscribedAt: subscribed ? null : new Date().toISOString(),
        };
        list[index] = updated;
        return json(200, updated);
      }

      if (request.method() === "DELETE" && customerId) {
        state.customers[businessId] = list.filter((candidate) => candidate.id !== customerId);
        return noContent();
      }
    }

    if (/^\/api\/businesses\/[^/]+\/campaigns$/.test(url.pathname)) {
      return json(200, []);
    }

    return json(404, { error: "Not mocked" });
  });

  return state;
}
```

- [ ] **Step 2: Remove the superseded legacy-page test from `e2e/shell.spec.ts`**

Delete the whole test `"a business created on the legacy Businesses page is known to the shell"` (the one that fills `getByPlaceholder("Business name")` and clicks "Add Business"). Its intent (a business created on the Businesses page is immediately usable) is covered by the new "New business creates…" test below. All other shell tests stay as they are.

- [ ] **Step 3: `e2e/businesses.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = {
  ...business("b1", "Corner Bakery"),
  description: "Fresh bread every morning.",
  email: "hello@bakery.test",
};
const florist = business("b2", "Fern Florist");

test.describe("businesses page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("lists each business with its details and an Open link", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await expect(page.getByRole("heading", { level: 1, name: "Businesses" })).toBeVisible();
    const card = page.getByRole("listitem").filter({ hasText: "Corner Bakery" });
    await expect(card.getByText("Fresh bread every morning.")).toBeVisible();
    await expect(card.getByText("hello@bakery.test")).toBeVisible();

    await card.getByRole("link", { name: "Open Corner Bakery" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/dashboard$/);
  });

  test("an empty account is invited to create its first business", async ({ page }) => {
    await mockApi(page, { businesses: [] });
    await page.goto("/businesses");

    await expect(page.getByRole("heading", { name: "Create your first business" })).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Create business" }).click();
    await expect(page.getByRole("dialog", { name: "Create a business" })).toBeVisible();
  });

  test("New business focuses the name field, creates the business and opens its dashboard", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "New business" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a business" });
    await expect(dialog.getByLabel("Business name")).toBeFocused();

    await dialog.getByLabel("Business name").fill("Night Market");
    await dialog.getByRole("button", { name: "Create business" }).click();

    await expect(page).toHaveURL(/\/businesses\/new-1\/dashboard$/);
    await expect(page.getByText("Business created")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business not found" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Managing Night Market/ })).toBeVisible();
  });

  test("edits a business and shows the new name", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Corner Bakery" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();

    const dialog = page.getByRole("dialog", { name: "Edit business" });
    await expect(dialog.getByLabel("Business name")).toHaveValue("Corner Bakery");
    await dialog.getByLabel("Business name").fill("Corner Bakery & Cafe");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Business updated")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corner Bakery & Cafe" })).toBeVisible();
    expect(
      api.requests.some((request) => request.method === "PUT" && request.path === "/api/businesses/b1"),
    ).toBe(true);
  });

  test("deleting a business requires typing its name", async ({ page }) => {
    const api = await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Fern Florist" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Fern Florist?" });
    const confirm = dialog.getByRole("button", { name: "Delete business" });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Type .Fern Florist. to confirm/).fill("Fern Florist");
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(page.getByText("Business deleted")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fern Florist" })).toHaveCount(0);
    expect(api.businesses.map((candidate) => candidate.id)).toEqual(["b1"]);
  });

  test("a delete in progress cannot be dismissed", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist], delayWritesMs: 1_500 });
    await page.goto("/businesses");

    await page.getByRole("button", { name: "Actions for Fern Florist" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete Fern Florist?" });
    await dialog.getByLabel(/Type .Fern Florist. to confirm/).fill("Fern Florist");
    await dialog.getByRole("button", { name: "Delete business" }).click();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await expect(page.getByText("Business deleted")).toBeVisible();
    await expect(dialog).toBeHidden();
  });
});
```

- [ ] **Step 4: `e2e/customers.spec.ts`**

```ts
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
    await dialog.getByLabel("Email").fill("bad");
    await dialog.getByRole("button", { name: "Add customer" }).click();
    await expect(dialog.getByText("Invalid email")).toBeVisible();

    const consent = dialog.getByLabel("Customer explicitly agreed to receive promotional emails");
    await expect(consent).not.toBeChecked();
    await consent.check();
    await dialog.getByLabel("Email").fill("kj@nasa.test");
    await dialog.getByRole("button", { name: "Add customer" }).click();

    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(page.getByRole("row", { name: /Katherine Johnson/ })).toContainText("Email opted in");

    const post = api.requests.find(
      (request) => request.method === "POST" && request.path === "/api/businesses/b1/customers" && (request.body as { email?: string }).email === "kj@nasa.test",
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

    await page.getByRole("button", { name: "Next" }).click();
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
```

- [ ] **Step 5: Update the spec**

In `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`:

1. In section 3a ("Changes since the first draft"), add this bullet to the "Backend rules the UI must respect" list:
   `- **Consent cannot distinguish "never opted in" from "unsubscribed".** Creating or editing a customer with no opt-ins stores \`unsubscribedAt = now\`, and the unsubscribe link sets \`emailOptIn=false\` plus \`unsubscribedAt\`. The Customers UI therefore shows two states: "Email opted in" (\`emailOptIn && !unsubscribedAt\`) and "Email not opted in".`
2. In the Customers paragraph of section 7, replace `consent filter (All, Email opted in, Not opted in, Unsubscribed)` with `consent filter (All customers, Opted in to email, Not opted in)` and replace `Email consent badge (Opted in / Not opted in / Unsubscribed)` with `Email consent badge (Email opted in / Email not opted in)`.
3. In section 10, append to the phase 2 line: ` The customer table appears at lg and above and stacks into cards below; the Businesses page reads the shared businesses list.`

- [ ] **Step 6: Run everything**

```bash
npx vitest run apps/web
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
npx playwright test
git checkout -- playwright-report test-results
git status --short
```

Expected:
- Vitest: all `apps/web` files pass.
- `tsc`: 0 errors (re-run after the build if only stale `.next/types` errors appear).
- Lint: 0 errors, at most 4 warnings (legacy campaign/dashboard pages), none in new files.
- Build: succeeds.
- Playwright: all pass (previously 18; minus the removed legacy test; plus 6 businesses + 10 customers tests).
- `git status --short`: only your intended changes.

If a Playwright test fails: diagnose the root cause before changing anything. Do not loosen an assertion. If it reveals a genuine product bug in Tasks 1–6, make the smallest correct fix, keep the test that exposed it, and describe it (file, symptom, root cause, fix) in the report.

- [ ] **Step 7: Visual and keyboard check**

With the mocked API (no real Supabase/API is needed or available), use a throwaway Playwright script or `--headed` to look at: `/businesses` (grid, empty state, delete dialog), `/businesses/b1/customers` (table at 1280px, stacked cards at 375px, empty/no-match/error states, the add dialog), in light and dark (`colorScheme`), saving screenshots to the scratchpad (not the repo) and viewing them. Check: no horizontal overflow at 375px; the row action menu is not clipped at the bottom of the table; focus rings are visible; the dialogs trap focus and Escape closes them. Record only what you actually saw, and state that authenticated pages were checked with mocks only. Delete any throwaway script before committing.

- [ ] **Step 8: Commit**

```bash
git add e2e docs/superpowers/specs/2026-10-08-ui-redesign-design.md
git commit -m "test(web): cover the Businesses and Customers pages; document the consent model" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git status --short
```

Expected: clean working tree (`playwright-report/` and `test-results/` restored, no throwaway files).
