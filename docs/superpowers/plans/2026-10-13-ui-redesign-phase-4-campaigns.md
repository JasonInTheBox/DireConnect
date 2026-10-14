# DireConnect UI Redesign, Phase 4: Campaign List and Guided Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Campaigns page (one long form plus dark cards) with a campaign list (status, schedule, delivery, row actions) and a guided four-step wizard (Basics, Recipients, Message, Review and send) that creates or edits email drafts, shows exactly who will receive the campaign, and queues it with clear blocking states and server-refusal handling.

**Architecture:** Pure logic (schedule conversion, display status, table labels, wizard values, validation, send-blocking rules, confirmation copy) lives in `src/lib` and is unit-tested in Node. The list page and the wizard are thin client components in `src/components/campaigns` and `src/components/campaigns/wizard`, fed by `useApi`/`apiFetch`. The wizard is one component that holds all step state, so going back never loses input; entering the Review step creates or updates the draft so the API can compute exact recipients. Playwright covers behaviour with mocked network responses.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, Vitest (node environment), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (sections 3, 3a, 7 "Campaign list" and "Campaign wizard", 8, 9). Phases 1 to 3 (tokens, shell, data layer, Businesses, Customers, Dashboard) are merged on `main`; this plan builds on their exact APIs.

## Global Constraints

Carried verbatim from Phases 1 to 3:

- Scope is `apps/web`, `e2e/`, and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts. No new dependencies.
- Light theme by default; dark follows `prefers-color-scheme`. Colours come only from the token utilities (`bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `text-accent-ink`, `bg-accent-soft`, `bg-success`/`text-success`/`bg-success-soft`, `bg-warning`/`text-warning`/`bg-warning-soft`, `bg-danger`/`text-danger`/`bg-danger-soft`, `rounded-control` = 6px, `rounded-container` = 10px, `shadow-float`). No raw `gray-`/`blue-` classes.
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Touch targets: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths; icon-only buttons `min-h-10 min-w-10`; text links used as controls get `min-h-10` (or are rendered with `buttonClasses`).
- Meaning is never conveyed by colour alone: every status carries an icon and a text label.
- Motion only in response to a user action. Loading indicators are exempt (reduced-motion disables them globally).
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- Copy: active voice, sentence case, the same verb for button and toast where truthful. Errors state what happened and how to fix it; no apologies.
- **Modal convention:** inside a dialog, errors are shown inline; a toast is fired as/after the dialog closes. Close every modal before toasting. Unmapped server field errors fall back to `FormError`. A dialog with a request in flight is not dismissible. (This plan's one exception, decided by the spec: a refused send closes the confirm dialog and shows a persistent inline panel on the Review step.)
- `useApi` returns `{ data, error, loading, slow, refetch }`, scopes its state to the current path, and keeps old data while the same path refetches. `apiFetch<T>(path, { method?, body?, signal? })` throws `ApiError { status, message, details }` and redirects to `/login` on 401. `useBusinesses()` returns `{ businesses, status, error, slow, refetch, addBusiness }`. `useSession()` returns `{ id, email, emailConfirmed }`. `useToast()` returns `{ success, error }`.
- Shell layout: pages render inside `<main id="main-content">`; use `PageContainer` + `PageHeader` (supplies the page's single `<h1>`, with `id="page-title"`). Key page content by `businessId` so state resets on business change.
- Work on branch `ui-redesign-phase-4`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` verbatim (whichever model you are).
- Playwright runs modify the TRACKED `playwright-report/` and `test-results/`; restore them after each run (`git checkout -- playwright-report test-results`) and never commit them.
- `apps/api/src/routes/campaign.test.ts` already fails on `main` because of a stale git-ignored `apps/api/src/config/env.js`; never touch that file. Expect exactly that one failing file in `npm test`.
- `apps/web/AGENTS.md` warns that this Next.js version differs from older ones; the patterns used by existing pages (`useParams`, `"use client"` pages, `useRouter` from `next/navigation`, `Link`) are known to work. Do not introduce new Next.js APIs.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

## Review Focus

Inputs and conditions the spec implies but does not spell out, most likely to bite first. Each is pinned by a test in the task named.

1. **Double activation.** Pressing "Review" twice (or double-clicking Send) must create one draft and one queue request, not two. (Tasks 4 and 5)
2. **Schedule values.** An empty, past or unparsable schedule must be refused before anything is sent; a valid local time must be sent as the matching ISO instant; a draft that still carries a past `sendAt` opens as "Send now", not as an error. (Tasks 1, 2 and 5)
3. **Whitespace-only name or message.** Must fail validation exactly like an empty one. (Tasks 2 and 4)
4. **Opening `/edit` for a campaign that cannot be edited** (sent, queued, SMS) or that does not exist must explain why and link back, not show a blank form. (Task 4)
5. **One failing delivery request must not break the list.** The other rows still show their numbers and the failed row says "Unavailable". (Task 3)

Also covered: switching business in the middle of the wizard returns to that business's list instead of leaking state (Task 4); a refused send keeps the draft and the panel stays until the user acts (Task 5).

## Facts about the campaign API this plan relies on

- `GET /api/businesses/:id/campaigns` returns every campaign, newest first. There is **no** endpoint for a single campaign, so the edit page reads the list and finds the campaign by id.
- `POST` and `PUT` take `{ title, message, channel, sendAt, targetAudience }` (`sendAt` is an ISO string or `""`; `""` clears it). `channel: "SMS"` is refused with 422. `PUT` only succeeds for `DRAFT` + `EMAIL` campaigns (otherwise 404 "Campaign not found. Queued or sent campaigns cannot be edited."). Validation failures are `400 { error: "Invalid request body", details: [{ path: [field], message }] }`.
- `GET .../campaigns/:id/preview` for a draft computes eligibility live from the current customers: `{ campaign, summary: { totalCustomers, eligibleCount, skippedCount, skippedByReason, isSnapshot }, eligible[], skipped[] }`, where a recipient is `{ customerId, recipient, eligible, reason }`. Skip reasons are `"Customer has unsubscribed"`, `"Customer has not opted in to EMAIL"`, `"Customer has no EMAIL recipient"`, `"Customer does not match campaign audience: <audience>"`.
- `POST .../campaigns/:id/queue` for a draft: 403 in production when the account email is unconfirmed or the account is not on the sender allowlist; 409 with `"This campaign has no eligible, opted-in email recipients."` for zero recipients; 409 with `eligibleCount` and `maxRecipients` above 10 recipients; otherwise 200. The queue step uses the draft's stored `sendAt`: empty or past means send now, future means scheduled. **So the final `PUT` (with the chosen timing) must happen before `queue`.**
- `GET .../campaigns/:id/analytics` returns `{ campaign, summary }` with `eligibleCount`, `sentCount`, `failedDeliveryCount`, `pendingCount`, `skippedBeforeSendCount` (and more).
- `DELETE .../campaigns/:id` works for drafts only (404 otherwise).
- The worker sends `subject = campaign.title` and appends an unsubscribe link to every email.
- `/dashboard` returns `summary.customers.emailOptedIn` (consent and not unsubscribed). That count includes customers with no email address, so the wizard's Recipients step presents it as "agreed to receive emails" and leaves the exact count to the Review step.

## Spec deviations (decided here)

- **Limits are mirrored, not imported.** `apps/web` has no dependency on `@direconnect/validation`, and importing it would need the package built before the Vercel web build. `src/lib/campaignLimits.ts` mirrors the constants, and a unit test imports the package's source file and asserts the values match, so they cannot drift silently.
- **The "email not confirmed" block has no link to Account**, because the Account page arrives in Phase 5. The message tells the user to open the confirmation email and reload; Phase 5 adds the link.
- **The campaign table appears at `xl` (1280px) and above; cards below.** With the sidebar open the content column is only about 720px wide at `lg`, too narrow for six columns.
- **"Save draft" saves and returns to the campaign list** (with a "Draft saved" toast); it is not a silent autosave. On the Review step the draft already exists, so it simply leaves.
- **"Scheduled" is derived client-side:** a `QUEUED` campaign whose `sendAt` is in the future. A queued campaign without a future time is "Queued" and the When column reads "Waiting to be sent".
- **Delivery numbers are fetched only for non-draft campaigns on the visible page** (25 per page).
- **Rows link to the existing preview (drafts) and analytics (everything else) routes** via the existing `campaignHref`; Phase 5 re-points them to the tabbed detail view.
- **The Recipients step's "Add customers" link opens in a new tab** so the wizard state is not lost.
- The legacy `analytics`, `logs` and `preview` pages are untouched in this phase.

## File structure

New (all under `apps/web/src`):

| File | Responsibility |
|---|---|
| `lib/campaignLimits.ts` | Mirrored launch limits |
| `lib/schedule.ts` | `datetime-local` to ISO conversion, future check, time-zone label, date formatting |
| `lib/campaignDisplay.ts` | When/Delivery labels, row actions, edit-block reason, skip-reason wording, page size |
| `lib/campaignWizard.ts` | Steps, values, validation, payload, send blocks, confirm copy |
| `lib/useCampaignDeliveries.ts` | Fetches delivery numbers for non-draft rows; failures are per row |
| `components/campaigns/campaign-table.tsx` | Table (xl+) and cards (below) with row actions |
| `components/campaigns/email-preview.tsx` | Live email preview card |
| `components/campaigns/wizard/stepper.tsx` | Step indicator |
| `components/campaigns/wizard/step-basics.tsx`, `step-recipients.tsx`, `step-message.tsx`, `step-review.tsx`, `recipient-summary.tsx`, `send-confirm-dialog.tsx` | The steps and their parts |
| `components/campaigns/wizard/campaign-wizard.tsx` | Wizard state and navigation |
| `app/(app)/businesses/[businessId]/campaigns/new/page.tsx` | New campaign page |
| `app/(app)/businesses/[businessId]/campaigns/[campaignId]/edit/page.tsx` | Edit draft page |
| `e2e/campaigns.spec.ts`, `e2e/campaign-wizard.spec.ts` | Behaviour tests |

Modified: `lib/types.ts`, `lib/format.ts` (+ test), `lib/campaignStatus.ts` (+ test), `components/campaigns/status-badge.tsx`, `app/(app)/businesses/[businessId]/campaigns/page.tsx` (rewritten), `e2e/helpers/app.ts`, `app/(app)/businesses/[businessId]/dashboard/page.tsx`, `components/dashboard/setup-checklist.tsx`, `e2e/dashboard.spec.ts`, the spec.

---

### Task 1: Types and pure display logic

**Files:**
- Create: `apps/web/src/lib/campaignLimits.ts`, `campaignLimits.test.ts`, `schedule.ts`, `schedule.test.ts`, `campaignDisplay.ts`, `campaignDisplay.test.ts`
- Modify: `apps/web/src/lib/types.ts`, `format.ts`, `format.test.ts`, `campaignStatus.ts`, `campaignStatus.test.ts`, `components/campaigns/status-badge.tsx`

**Interfaces:**
- Consumes: `CampaignStatus`, `CampaignChannel`, `CampaignAudience` from `lib/types.ts`.
- Produces (later tasks rely on these exact names):
  - `types.ts`: `Campaign`, `CampaignAnalyticsSummary`, `CampaignAnalyticsResponse`, `PreviewRecipient`, `CampaignPreviewResponse`.
  - `format.ts`: `pluralize(count: number, singular: string, plural?: string): string` (returns e.g. `"2 customers"`).
  - `campaignLimits.ts`: `CAMPAIGN_LIMITS`.
  - `schedule.ts`: `toLocalInput(iso)`, `localInputToIso(value)`, `isFutureIso(iso, now?)`, `validateSchedule(value, now?)`, `localTimeZoneLabel()`, `formatDateTime(iso, timeZone?)`.
  - `campaignStatus.ts`: `DisplayStatus`, `displayStatusOf(campaign, now?)`, `displayStatusMeta(key)`.
  - `campaignDisplay.ts`: `CAMPAIGNS_PAGE_SIZE`, `CampaignDelivery`, `whenLabel`, `deliveryLabel`, `rowActionsFor`, `editBlockReason`, `plainSkipReason`, `skippedReasons`.
  - `CampaignStatusBadge({ status, sendAt? })`.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git checkout -b ui-redesign-phase-4
```

- [ ] **Step 2: Add the types**

Append to `apps/web/src/lib/types.ts`:

```ts
export type Campaign = {
  id: string;
  ownerId: string;
  businessId: string;
  title: string;
  message: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  sendAt?: string | null;
  targetAudience: CampaignAudience;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAnalyticsSummary = {
  analyticsSource: "SNAPSHOT" | "LEGACY_LOGS";
  hasSnapshot: boolean;
  totalSnapshotCount: number;
  totalRecipientCount: number;
  eligibleCount: number;
  skippedBeforeSendCount: number;
  attemptedSendCount: number;
  sentCount: number;
  failedDeliveryCount: number;
  pendingCount: number;
  totalLogCount: number;
  sentRate: number | null;
  skippedByReason: Record<string, number>;
  failedByReason: Record<string, number>;
};

export type CampaignAnalyticsResponse = {
  campaign: Pick<Campaign, "id" | "title" | "channel" | "targetAudience" | "status">;
  summary: CampaignAnalyticsSummary;
};

export type PreviewRecipient = {
  customerId: string;
  recipient: string | null;
  eligible: boolean;
  reason: string | null;
};

export type CampaignPreviewResponse = {
  campaign: Pick<Campaign, "id" | "title" | "channel" | "targetAudience" | "status">;
  summary: {
    totalCustomers: number;
    eligibleCount: number;
    skippedCount: number;
    skippedByReason: Record<string, number>;
    isSnapshot: boolean;
  };
  eligible: PreviewRecipient[];
  skipped: PreviewRecipient[];
};
```

- [ ] **Step 3: Write the failing tests**

Replace the import line of `apps/web/src/lib/format.test.ts` with `import { monogramFor, pluralize } from "./format";` and append:

```ts
describe("pluralize", () => {
  it("uses the singular only for exactly one", () => {
    expect(pluralize(1, "customer")).toBe("1 customer");
    expect(pluralize(0, "customer")).toBe("0 customers");
    expect(pluralize(2, "customer")).toBe("2 customers");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
});
```

Create `apps/web/src/lib/campaignLimits.test.ts`:

```ts
import { describe, expect, it } from "vitest";
// Imported by relative path on purpose: apps/web does not depend on the package, but the values must match.
import { CAMPAIGN_EMAIL_SAFETY_LIMITS } from "../../../../packages/validation/src/campaignSafety";
import { CAMPAIGN_LIMITS } from "./campaignLimits";

describe("CAMPAIGN_LIMITS", () => {
  it("mirrors the API's email safety limits", () => {
    expect(CAMPAIGN_LIMITS.maxRecipientsPerCampaign).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxRecipientsPerCampaign,
    );
    expect(CAMPAIGN_LIMITS.maxEmailsPerRecipientPer24Hours).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxEmailsPerRecipientPer24Hours,
    );
  });
});
```

Create `apps/web/src/lib/schedule.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  isFutureIso,
  localInputToIso,
  localTimeZoneLabel,
  toLocalInput,
  validateSchedule,
} from "./schedule";

// Tests build dates with the local-time constructor so they hold in any time zone.
const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute);

describe("toLocalInput / localInputToIso", () => {
  it("converts an ISO instant to the datetime-local format in local time", () => {
    expect(toLocalInput(local(2030, 1, 15, 9, 30).toISOString())).toBe("2030-01-15T09:30");
  });

  it("converts a datetime-local value to the matching ISO instant", () => {
    expect(localInputToIso("2030-01-15T09:30")).toBe(local(2030, 1, 15, 9, 30).toISOString());
  });

  it("round-trips to the minute", () => {
    const iso = local(2031, 12, 31, 23, 59).toISOString();
    expect(localInputToIso(toLocalInput(iso))).toBe(iso);
  });

  it("returns empty or null for blank and unparsable input", () => {
    expect(toLocalInput("")).toBe("");
    expect(toLocalInput("nonsense")).toBe("");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("   ")).toBeNull();
    expect(localInputToIso("nonsense")).toBeNull();
  });
});

describe("isFutureIso", () => {
  const now = local(2030, 1, 15, 9, 0);

  it("is true only strictly after now", () => {
    expect(isFutureIso(local(2030, 1, 15, 9, 1).toISOString(), now)).toBe(true);
    expect(isFutureIso(now.toISOString(), now)).toBe(false);
    expect(isFutureIso(local(2030, 1, 14, 9, 0).toISOString(), now)).toBe(false);
    expect(isFutureIso("nonsense", now)).toBe(false);
  });
});

describe("validateSchedule", () => {
  const now = local(2030, 1, 15, 9, 0);

  it("accepts a future time", () => {
    expect(validateSchedule("2030-01-15T09:30", now)).toBeNull();
  });

  it("asks for a value when blank", () => {
    expect(validateSchedule("", now)).toBe("Choose a date and time.");
    expect(validateSchedule("   ", now)).toBe("Choose a date and time.");
  });

  it("rejects an unparsable value", () => {
    expect(validateSchedule("not a date", now)).toBe("Enter a valid date and time.");
  });

  it("rejects the past and the present", () => {
    expect(validateSchedule("2030-01-15T08:59", now)).toBe("Choose a time in the future.");
    expect(validateSchedule("2030-01-15T09:00", now)).toBe("Choose a time in the future.");
  });
});

describe("formatDateTime", () => {
  it("formats in the requested time zone", () => {
    expect(formatDateTime("2030-02-01T09:30:00.000Z", "UTC")).toMatch(/^Feb 1, 2030, 9:30\sAM$/);
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDateTime("nonsense")).toBe("");
  });
});

describe("localTimeZoneLabel", () => {
  it("names a time zone", () => {
    expect(localTimeZoneLabel().length).toBeGreaterThan(0);
  });
});
```

Create `apps/web/src/lib/campaignDisplay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  deliveryLabel,
  editBlockReason,
  plainSkipReason,
  rowActionsFor,
  skippedReasons,
  whenLabel,
} from "./campaignDisplay";

const now = new Date("2030-01-15T12:00:00.000Z");
const updatedAt = "2030-01-10T08:00:00.000Z";

describe("whenLabel", () => {
  it("explains a draft", () => {
    expect(whenLabel({ status: "DRAFT", sendAt: null, updatedAt }, now, "UTC")).toBe("Not scheduled");
    expect(
      whenLabel({ status: "DRAFT", sendAt: "2030-02-01T09:30:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Planned for Feb 1, 2030/);
  });

  it("says a queued campaign without a future time is waiting to be sent", () => {
    expect(whenLabel({ status: "QUEUED", sendAt: null, updatedAt }, now, "UTC")).toBe(
      "Waiting to be sent",
    );
    expect(
      whenLabel({ status: "QUEUED", sendAt: "2030-01-14T09:00:00.000Z", updatedAt }, now, "UTC"),
    ).toBe("Waiting to be sent");
  });

  it("shows the time of a scheduled campaign", () => {
    expect(
      whenLabel({ status: "QUEUED", sendAt: "2030-02-01T09:30:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Feb 1, 2030/);
  });

  it("uses the send time, or when the campaign last changed", () => {
    expect(
      whenLabel({ status: "SENT", sendAt: "2030-01-12T10:00:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Jan 12, 2030/);
    expect(whenLabel({ status: "FAILED", sendAt: null, updatedAt }, now, "UTC")).toMatch(
      /^Jan 10, 2030/,
    );
  });
});

describe("deliveryLabel", () => {
  const sent = { status: "SENT" } as const;
  const ready = (
    eligibleCount: number,
    sentCount: number,
    failedDeliveryCount = 0,
    pendingCount = 0,
  ) => ({
    status: "ready" as const,
    summary: { eligibleCount, sentCount, failedDeliveryCount, pendingCount },
  });

  it("never asks for numbers for a draft", () => {
    expect(deliveryLabel({ status: "DRAFT" }, undefined)).toBe("Not sent yet");
  });

  it("says when the numbers are loading or unavailable", () => {
    expect(deliveryLabel(sent, undefined)).toBe("Loading…");
    expect(deliveryLabel(sent, { status: "loading" })).toBe("Loading…");
    expect(deliveryLabel(sent, { status: "error" })).toBe("Unavailable");
  });

  it("summarises sent, failed and pending", () => {
    expect(deliveryLabel(sent, ready(4, 3, 1))).toBe("3 of 4 sent, 1 failed");
    expect(deliveryLabel(sent, ready(3, 1, 0, 2))).toBe("1 of 3 sent, 2 pending");
    expect(deliveryLabel(sent, ready(5, 5))).toBe("5 of 5 sent");
    expect(deliveryLabel({ status: "QUEUED" }, ready(2, 0))).toBe("0 of 2 sent");
  });

  it("handles a campaign with no recipients", () => {
    expect(deliveryLabel(sent, ready(0, 0))).toBe("No recipients");
  });
});

describe("rowActionsFor", () => {
  it("offers edit and delete for email drafts", () => {
    expect(rowActionsFor({ status: "DRAFT", channel: "EMAIL" })).toEqual(["edit", "delete"]);
  });

  it("offers only delete for an SMS draft", () => {
    expect(rowActionsFor({ status: "DRAFT", channel: "SMS" })).toEqual(["delete"]);
  });

  it("offers nothing once a campaign is queued, sent or failed", () => {
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(rowActionsFor({ status, channel: "EMAIL" })).toEqual([]);
    }
  });
});

describe("editBlockReason", () => {
  it("allows editing an email draft", () => {
    expect(editBlockReason({ status: "DRAFT", channel: "EMAIL" })).toBeNull();
  });

  it("explains why SMS and non-draft campaigns cannot be edited", () => {
    expect(editBlockReason({ status: "DRAFT", channel: "SMS" })).toMatch(/SMS/);
    expect(editBlockReason({ status: "SENT", channel: "EMAIL" })).toMatch(/can’t be edited/);
    expect(editBlockReason({ status: "QUEUED", channel: "EMAIL" })).toMatch(/can’t be edited/);
  });
});

describe("plainSkipReason / skippedReasons", () => {
  it("translates the API's reasons", () => {
    expect(plainSkipReason("Customer has no EMAIL recipient")).toBe("No email address");
    expect(plainSkipReason("Customer has unsubscribed")).toBe("Hasn’t agreed to receive emails");
    expect(plainSkipReason("Customer has not opted in to EMAIL")).toBe(
      "Hasn’t agreed to receive emails",
    );
    expect(plainSkipReason("Customer does not match campaign audience: SMS_OPTED_IN")).toBe(
      "Not in this campaign’s audience",
    );
    expect(plainSkipReason("Something new")).toBe("Something new");
    expect(plainSkipReason(null)).toBe("Not eligible");
  });

  it("merges reasons that read the same and sorts by count", () => {
    // The API stores "unsubscribed" for people who never opted in, so both read as one reason.
    expect(
      skippedReasons({
        "Customer has unsubscribed": 2,
        "Customer has not opted in to EMAIL": 1,
        "Customer has no EMAIL recipient": 1,
      }),
    ).toEqual([
      { label: "Hasn’t agreed to receive emails", count: 3 },
      { label: "No email address", count: 1 },
    ]);
  });

  it("returns nothing when no one was skipped", () => {
    expect(skippedReasons({})).toEqual([]);
  });
});
```

Append to `apps/web/src/lib/campaignStatus.test.ts` (change its import to `import { campaignStatusMeta, channelLabel, displayStatusMeta, displayStatusOf } from "./campaignStatus";`):

```ts
describe("displayStatusOf", () => {
  const now = new Date("2030-01-15T12:00:00.000Z");

  it("shows a queued campaign with a future send time as Scheduled", () => {
    expect(displayStatusOf({ status: "QUEUED", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe(
      "SCHEDULED",
    );
  });

  it("keeps Queued when there is no future send time", () => {
    expect(displayStatusOf({ status: "QUEUED", sendAt: null }, now)).toBe("QUEUED");
    expect(displayStatusOf({ status: "QUEUED" }, now)).toBe("QUEUED");
    expect(displayStatusOf({ status: "QUEUED", sendAt: "2030-01-14T09:00:00.000Z" }, now)).toBe(
      "QUEUED",
    );
    expect(displayStatusOf({ status: "QUEUED", sendAt: "nonsense" }, now)).toBe("QUEUED");
  });

  it("never turns another status into Scheduled", () => {
    expect(displayStatusOf({ status: "DRAFT", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe(
      "DRAFT",
    );
    expect(displayStatusOf({ status: "SENT", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe("SENT");
  });
});

describe("displayStatusMeta", () => {
  it("gives Scheduled its own label and icon", () => {
    expect(displayStatusMeta("SCHEDULED")).toEqual({
      label: "Scheduled",
      tone: "accent",
      icon: "clock",
    });
  });

  it("never reuses an icon across the five display statuses", () => {
    const icons = (["DRAFT", "QUEUED", "SCHEDULED", "SENT", "FAILED"] as const).map(
      (key) => displayStatusMeta(key).icon,
    );
    expect(new Set(icons).size).toBe(5);
  });
});
```

- [ ] **Step 4: Run the tests to see them fail**

Run: `npx vitest run apps/web/src/lib`
Expected: the new test files fail to import (modules not found) and `format.test.ts` / `campaignStatus.test.ts` fail on the missing exports.

- [ ] **Step 5: Implement**

Append to `apps/web/src/lib/format.ts`:

```ts
/** "1 customer", "2 customers": the count with the right noun. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
```

Create `apps/web/src/lib/campaignLimits.ts`:

```ts
/**
 * Mirrors CAMPAIGN_EMAIL_SAFETY_LIMITS in packages/validation/src/campaignSafety.ts.
 * apps/web does not depend on that package; campaignLimits.test.ts fails if the values drift.
 */
export const CAMPAIGN_LIMITS = {
  maxRecipientsPerCampaign: 10,
  maxEmailsPerRecipientPer24Hours: 1,
} as const;
```

Create `apps/web/src/lib/schedule.ts`:

```ts
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An ISO instant as the local `YYYY-MM-DDTHH:mm` a datetime-local input expects ("" if invalid). */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value (local time) as an ISO instant; null when blank or unparsable. */
export function localInputToIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isFutureIso(iso: string, now: Date = new Date()): boolean {
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time > now.getTime();
}

/** The error to show for a schedule value, or null when it is a valid future time. */
export function validateSchedule(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) {
    return "Choose a date and time.";
  }
  const iso = localInputToIso(value);
  if (iso === null) {
    return "Enter a valid date and time.";
  }
  return isFutureIso(iso, now) ? null : "Choose a time in the future.";
}

/** The browser's time zone, for example "Europe/London". */
export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time zone";
}

export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
```

Replace `apps/web/src/lib/campaignStatus.ts` with:

```ts
import type { CampaignChannel, CampaignStatus } from "./types";

export type StatusTone = "neutral" | "accent" | "success" | "danger";
export type StatusIcon = "edit" | "send" | "check" | "alert" | "clock";

/** The API's four statuses plus Scheduled, which is a queued campaign with a future send time. */
export type DisplayStatus = CampaignStatus | "SCHEDULED";

const STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: "edit" },
  QUEUED: { label: "Queued", tone: "accent", icon: "send" },
  SENT: { label: "Sent", tone: "success", icon: "check" },
  FAILED: { label: "Failed", tone: "danger", icon: "alert" },
};

const DISPLAY_META: Record<DisplayStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  ...STATUS_META,
  SCHEDULED: { label: "Scheduled", tone: "accent", icon: "clock" },
};

/** Every status has its own icon as well as a colour, so it never relies on colour alone. */
export function campaignStatusMeta(status: CampaignStatus) {
  return STATUS_META[status];
}

export function displayStatusMeta(key: DisplayStatus) {
  return DISPLAY_META[key];
}

export function displayStatusOf(
  campaign: { status: CampaignStatus; sendAt?: string | null },
  now: Date = new Date(),
): DisplayStatus {
  if (campaign.status === "QUEUED" && campaign.sendAt) {
    const time = new Date(campaign.sendAt).getTime();
    if (!Number.isNaN(time) && time > now.getTime()) {
      return "SCHEDULED";
    }
  }
  return campaign.status;
}

export function channelLabel(channel: CampaignChannel): string {
  return channel === "SMS" ? "SMS" : "Email";
}
```

Create `apps/web/src/lib/campaignDisplay.ts`:

```ts
import { displayStatusOf } from "./campaignStatus";
import { formatDateTime } from "./schedule";
import type { Campaign, CampaignAnalyticsSummary } from "./types";

export const CAMPAIGNS_PAGE_SIZE = 25;

export type CampaignDelivery =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      summary: Pick<
        CampaignAnalyticsSummary,
        "eligibleCount" | "sentCount" | "failedDeliveryCount" | "pendingCount"
      >;
    };

/** The "When" column: the scheduled time, the send time, or why there is none yet. */
export function whenLabel(
  campaign: Pick<Campaign, "status" | "sendAt" | "updatedAt">,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const key = displayStatusOf(campaign, now);
  const sendAt = campaign.sendAt ? formatDateTime(campaign.sendAt, timeZone) : "";

  switch (key) {
    case "DRAFT":
      return sendAt ? `Planned for ${sendAt}` : "Not scheduled";
    case "QUEUED":
      return "Waiting to be sent";
    case "SCHEDULED":
      return sendAt;
    default:
      return sendAt || formatDateTime(campaign.updatedAt, timeZone);
  }
}

/** The "Delivery" column: how many of the eligible recipients were sent, failed or are pending. */
export function deliveryLabel(
  campaign: Pick<Campaign, "status">,
  delivery: CampaignDelivery | undefined,
): string {
  if (campaign.status === "DRAFT") {
    return "Not sent yet";
  }
  if (!delivery || delivery.status === "loading") {
    return "Loading…";
  }
  if (delivery.status === "error") {
    return "Unavailable";
  }

  const { eligibleCount, sentCount, failedDeliveryCount, pendingCount } = delivery.summary;
  if (eligibleCount + sentCount + failedDeliveryCount + pendingCount === 0) {
    return "No recipients";
  }

  const parts = [`${sentCount} of ${eligibleCount} sent`];
  if (failedDeliveryCount > 0) {
    parts.push(`${failedDeliveryCount} failed`);
  }
  if (pendingCount > 0) {
    parts.push(`${pendingCount} pending`);
  }
  return parts.join(", ");
}

export type RowAction = "edit" | "delete";

/** Only drafts can change; SMS drafts (SMS is paused) can only be deleted. */
export function rowActionsFor(campaign: Pick<Campaign, "status" | "channel">): RowAction[] {
  if (campaign.status !== "DRAFT") {
    return [];
  }
  return campaign.channel === "EMAIL" ? ["edit", "delete"] : ["delete"];
}

/** Why a campaign cannot be opened in the wizard, or null when it can. */
export function editBlockReason(campaign: Pick<Campaign, "status" | "channel">): string | null {
  if (campaign.channel === "SMS") {
    return "SMS sending is paused, so this campaign can’t be edited.";
  }
  if (campaign.status !== "DRAFT") {
    return "Queued and sent campaigns can’t be edited.";
  }
  return null;
}

/**
 * Plain wording for the API's skip reasons. The API stores "unsubscribed" for people who never
 * opted in, so "unsubscribed" and "not opted in" read as one reason.
 */
export function plainSkipReason(reason: string | null): string {
  if (!reason) {
    return "Not eligible";
  }
  if (reason === "Customer has unsubscribed" || reason.startsWith("Customer has not opted in")) {
    return "Hasn’t agreed to receive emails";
  }
  if (reason.startsWith("Customer has no ")) {
    return "No email address";
  }
  if (reason.startsWith("Customer does not match campaign audience")) {
    return "Not in this campaign’s audience";
  }
  return reason;
}

export function skippedReasons(
  skippedByReason: Record<string, number>,
): Array<{ label: string; count: number }> {
  const merged = new Map<string, number>();
  for (const [reason, count] of Object.entries(skippedByReason)) {
    const label = plainSkipReason(reason);
    merged.set(label, (merged.get(label) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
```

Replace `apps/web/src/components/campaigns/status-badge.tsx` with:

```tsx
import { Badge } from "@/components/ui/badge";
import { displayStatusMeta, displayStatusOf } from "@/lib/campaignStatus";
import type { CampaignStatus } from "@/lib/types";

/**
 * Draft, Queued, Scheduled, Sent or Failed: always an icon plus a word, never colour alone.
 * Pass `sendAt` when it is known (the campaign list) so a queued campaign with a future time
 * reads Scheduled; the dashboard payload has no send time and passes only the status.
 */
export function CampaignStatusBadge({
  status,
  sendAt,
}: {
  status: CampaignStatus;
  sendAt?: string | null;
}) {
  const meta = displayStatusMeta(displayStatusOf({ status, sendAt }));

  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
```

- [ ] **Step 6: Run the tests and checks**

Run: `npx vitest run apps/web`
Expected: all pass (previous 131 plus the new ones).

Run: `npx tsc --noEmit -p apps/web` and `npm run lint -w apps/web`
Expected: exit 0; lint 0 errors (4 pre-existing warnings).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add campaign types and display logic for the list and wizard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wizard logic

**Files:**
- Create: `apps/web/src/lib/campaignWizard.ts`, `apps/web/src/lib/campaignWizard.test.ts`

**Interfaces:**
- Consumes: `CAMPAIGN_LIMITS`, `pluralize`, `isFutureIso`, `localInputToIso`, `toLocalInput`, `validateSchedule`, `Campaign`.
- Produces: `WIZARD_STEPS`, `WizardStepId`, `SendTiming`, `WizardValues`, `wizardValues(campaign?, now?)`, `validateStep(step, values, now?)`, `canSaveDraft(values)`, `campaignPayload(values)`, `SendBlock`, `sendBlocks({ eligibleCount, emailConfirmed })`, `confirmCopy({ recipientCount, timing, scheduledLabel })`, `submitLabel(timing)`, `successMessage(timing)`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/campaignWizard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  campaignPayload,
  canSaveDraft,
  confirmCopy,
  sendBlocks,
  submitLabel,
  successMessage,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardValues,
} from "./campaignWizard";

const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute);
const now = local(2030, 1, 15, 9, 0);

function values(overrides: Partial<WizardValues> = {}): WizardValues {
  return {
    title: "Autumn menu",
    message: "Fresh loaves.",
    timing: "now",
    scheduledAt: "",
    audience: "ALL",
    ...overrides,
  };
}

describe("WIZARD_STEPS", () => {
  it("lists the four steps in order", () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual([
      "basics",
      "recipients",
      "message",
      "review",
    ]);
  });
});

describe("wizardValues", () => {
  it("starts empty for a new campaign", () => {
    expect(wizardValues(null, now)).toEqual({
      title: "",
      message: "",
      timing: "now",
      scheduledAt: "",
      audience: "ALL",
    });
  });

  it("loads a draft and opens a future send time as a schedule in local time", () => {
    const sendAt = local(2030, 1, 20, 9, 30).toISOString();
    expect(
      wizardValues({ title: "Hi", message: "Body", sendAt, targetAudience: "ALL" }, now),
    ).toEqual({
      title: "Hi",
      message: "Body",
      timing: "schedule",
      scheduledAt: "2030-01-20T09:30",
      audience: "ALL",
    });
  });

  it("opens a draft with a past send time as Send now, with no error", () => {
    const sendAt = local(2030, 1, 10, 9, 30).toISOString();
    const result = wizardValues(
      { title: "Hi", message: "Body", sendAt, targetAudience: "ALL" },
      now,
    );
    expect(result.timing).toBe("now");
    expect(result.scheduledAt).toBe("");
  });

  it("preserves an email opted-in audience and maps anything else to ALL", () => {
    const base = { title: "Hi", message: "Body", sendAt: null };
    expect(wizardValues({ ...base, targetAudience: "EMAIL_OPTED_IN" }, now).audience).toBe(
      "EMAIL_OPTED_IN",
    );
    expect(wizardValues({ ...base, targetAudience: "SMS_OPTED_IN" }, now).audience).toBe("ALL");
  });
});

describe("validateStep", () => {
  it("requires a campaign name, ignoring whitespace", () => {
    expect(validateStep("basics", values({ title: "" }), now)).toEqual({
      title: "Enter a campaign name.",
    });
    expect(validateStep("basics", values({ title: "   " }), now)).toEqual({
      title: "Enter a campaign name.",
    });
    expect(validateStep("basics", values(), now)).toEqual({});
  });

  it("requires a message, ignoring whitespace", () => {
    expect(validateStep("message", values({ message: " \n " }), now)).toEqual({
      message: "Write the message your customers will read.",
    });
    expect(validateStep("message", values(), now)).toEqual({});
  });

  it("has nothing to validate on Recipients", () => {
    expect(validateStep("recipients", values({ title: "", message: "" }), now)).toEqual({});
  });

  it("validates the schedule only when scheduling", () => {
    expect(validateStep("review", values({ timing: "now", scheduledAt: "" }), now)).toEqual({});
    expect(validateStep("review", values({ timing: "schedule", scheduledAt: "" }), now)).toEqual({
      scheduledAt: "Choose a date and time.",
    });
    expect(
      validateStep("review", values({ timing: "schedule", scheduledAt: "2030-01-14T09:00" }), now),
    ).toEqual({ scheduledAt: "Choose a time in the future." });
    expect(
      validateStep("review", values({ timing: "schedule", scheduledAt: "2030-01-16T09:00" }), now),
    ).toEqual({});
  });
});

describe("canSaveDraft", () => {
  it("needs a name and a message", () => {
    expect(canSaveDraft(values())).toBe(true);
    expect(canSaveDraft(values({ title: "  " }))).toBe(false);
    expect(canSaveDraft(values({ message: "" }))).toBe(false);
  });
});

describe("campaignPayload", () => {
  it("sends an email campaign with an empty sendAt for Send now", () => {
    expect(campaignPayload(values({ title: "  Autumn menu ", message: " Fresh loaves. " }))).toEqual({
      title: "Autumn menu",
      message: "Fresh loaves.",
      channel: "EMAIL",
      targetAudience: "ALL",
      sendAt: "",
    });
  });

  it("sends the schedule as an ISO instant", () => {
    const payload = campaignPayload(values({ timing: "schedule", scheduledAt: "2030-01-20T09:30" }));
    expect(payload.sendAt).toBe(local(2030, 1, 20, 9, 30).toISOString());
  });

  it("clears sendAt when scheduling with an unusable value", () => {
    expect(campaignPayload(values({ timing: "schedule", scheduledAt: "" })).sendAt).toBe("");
    expect(campaignPayload(values({ timing: "schedule", scheduledAt: "junk" })).sendAt).toBe("");
  });

  it("preserves a legacy audience", () => {
    expect(campaignPayload(values({ audience: "EMAIL_OPTED_IN" })).targetAudience).toBe(
      "EMAIL_OPTED_IN",
    );
  });
});

describe("sendBlocks", () => {
  it("blocks nothing for a normal campaign", () => {
    expect(sendBlocks({ eligibleCount: 3, emailConfirmed: true })).toEqual([]);
    expect(sendBlocks({ eligibleCount: 10, emailConfirmed: true })).toEqual([]);
  });

  it("blocks zero recipients", () => {
    const blocks = sendBlocks({ eligibleCount: 0, emailConfirmed: true });
    expect(blocks.map((block) => block.code)).toEqual(["no-recipients"]);
  });

  it("blocks more than the limit and states both numbers", () => {
    const blocks = sendBlocks({ eligibleCount: 11, emailConfirmed: true });
    expect(blocks.map((block) => block.code)).toEqual(["over-limit"]);
    expect(blocks[0].message).toContain("10");
    expect(blocks[0].message).toContain("11");
  });

  it("blocks an unconfirmed email address", () => {
    expect(sendBlocks({ eligibleCount: 3, emailConfirmed: false }).map((b) => b.code)).toEqual([
      "email-unconfirmed",
    ]);
  });

  it("reports every applicable block", () => {
    expect(sendBlocks({ eligibleCount: 0, emailConfirmed: false }).map((b) => b.code)).toEqual([
      "no-recipients",
      "email-unconfirmed",
    ]);
  });
});

describe("confirmCopy and labels", () => {
  it("words the Send now confirmation", () => {
    expect(confirmCopy({ recipientCount: 1, timing: "now", scheduledLabel: "" })).toEqual({
      title: "Send to 1 customer now?",
      description: "Queued campaigns can’t be edited or cancelled.",
      confirmLabel: "Send now",
    });
    expect(confirmCopy({ recipientCount: 4, timing: "now", scheduledLabel: "" }).title).toBe(
      "Send to 4 customers now?",
    );
  });

  it("words the Schedule confirmation with the time", () => {
    const copy = confirmCopy({
      recipientCount: 2,
      timing: "schedule",
      scheduledLabel: "Jan 20, 2030, 9:30 AM",
    });
    expect(copy.title).toBe("Schedule for 2 customers?");
    expect(copy.description).toContain("Jan 20, 2030, 9:30 AM");
    expect(copy.description).toContain("can’t be edited or cancelled");
    expect(copy.confirmLabel).toBe("Schedule campaign");
  });

  it("labels the submit button and the success toast", () => {
    expect(submitLabel("now")).toBe("Send now");
    expect(submitLabel("schedule")).toBe("Schedule campaign");
    expect(successMessage("now")).toBe("Campaign queued");
    expect(successMessage("schedule")).toBe("Campaign scheduled");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run apps/web/src/lib/campaignWizard.test.ts`
Expected: FAIL, module `./campaignWizard` not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/campaignWizard.ts`:

```ts
import { CAMPAIGN_LIMITS } from "./campaignLimits";
import { pluralize } from "./format";
import { isFutureIso, localInputToIso, toLocalInput, validateSchedule } from "./schedule";
import type { Campaign } from "./types";

export const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "recipients", label: "Recipients" },
  { id: "message", label: "Message" },
  { id: "review", label: "Review and send" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];
export type SendTiming = "now" | "schedule";

export type WizardValues = {
  title: string;
  message: string;
  timing: SendTiming;
  /** A datetime-local value in the user's time zone; only used when `timing` is "schedule". */
  scheduledAt: string;
  /** New campaigns always send ALL; a legacy EMAIL_OPTED_IN draft keeps its value. */
  audience: "ALL" | "EMAIL_OPTED_IN";
};

export function wizardValues(
  campaign?: Pick<Campaign, "title" | "message" | "sendAt" | "targetAudience"> | null,
  now: Date = new Date(),
): WizardValues {
  const sendAt = campaign?.sendAt ?? null;
  // A send time that has already passed means "send now"; it is not an error on opening a draft.
  const scheduled = sendAt !== null && isFutureIso(sendAt, now);

  return {
    title: campaign?.title ?? "",
    message: campaign?.message ?? "",
    timing: scheduled ? "schedule" : "now",
    scheduledAt: scheduled && sendAt ? toLocalInput(sendAt) : "",
    audience: campaign?.targetAudience === "EMAIL_OPTED_IN" ? "EMAIL_OPTED_IN" : "ALL",
  };
}

export function validateStep(
  step: WizardStepId,
  values: WizardValues,
  now: Date = new Date(),
): Record<string, string> {
  if (step === "basics") {
    return values.title.trim() ? {} : { title: "Enter a campaign name." };
  }
  if (step === "message") {
    return values.message.trim() ? {} : { message: "Write the message your customers will read." };
  }
  if (step === "review" && values.timing === "schedule") {
    const error = validateSchedule(values.scheduledAt, now);
    return error ? { scheduledAt: error } : {};
  }
  return {};
}

export function canSaveDraft(values: WizardValues): boolean {
  return Boolean(values.title.trim() && values.message.trim());
}

/** The API body for POST/PUT. `sendAt: ""` clears the send time (send now). */
export function campaignPayload(values: WizardValues) {
  const sendAt = values.timing === "schedule" ? (localInputToIso(values.scheduledAt) ?? "") : "";

  return {
    title: values.title.trim(),
    message: values.message.trim(),
    channel: "EMAIL" as const,
    targetAudience: values.audience,
    sendAt,
  };
}

export type SendBlock = {
  code: "no-recipients" | "over-limit" | "email-unconfirmed";
  title: string;
  message: string;
};

/** Reasons the Send button must stay disabled, each explained in plain language. */
export function sendBlocks({
  eligibleCount,
  emailConfirmed,
}: {
  eligibleCount: number;
  emailConfirmed: boolean;
}): SendBlock[] {
  const max = CAMPAIGN_LIMITS.maxRecipientsPerCampaign;
  const blocks: SendBlock[] = [];

  if (eligibleCount <= 0) {
    blocks.push({
      code: "no-recipients",
      title: "No one can receive this campaign yet",
      message:
        "Campaigns go to customers who agreed to receive promotional emails and have an email address. Add or update customers, then check again.",
    });
  }

  if (eligibleCount > max) {
    blocks.push({
      code: "over-limit",
      title: "Too many recipients",
      message: `Campaigns are limited to ${pluralize(max, "recipient")} for now, and this one would reach ${eligibleCount}. Update your customers so ${max} or fewer can receive it, then check again.`,
    });
  }

  if (!emailConfirmed) {
    blocks.push({
      code: "email-unconfirmed",
      title: "Confirm your email address first",
      message:
        "Campaigns can only be sent from accounts with a confirmed email address. Open the confirmation email we sent you, then reload this page.",
    });
  }

  return blocks;
}

export function confirmCopy({
  recipientCount,
  timing,
  scheduledLabel,
}: {
  recipientCount: number;
  timing: SendTiming;
  scheduledLabel: string;
}): { title: string; description: string; confirmLabel: string } {
  const people = pluralize(recipientCount, "customer");
  const note = "Queued campaigns can’t be edited or cancelled.";

  if (timing === "schedule") {
    return {
      title: `Schedule for ${people}?`,
      description: `Your campaign will be sent on ${scheduledLabel}. ${note}`,
      confirmLabel: "Schedule campaign",
    };
  }

  return { title: `Send to ${people} now?`, description: note, confirmLabel: "Send now" };
}

export function submitLabel(timing: SendTiming): string {
  return timing === "schedule" ? "Schedule campaign" : "Send now";
}

export function successMessage(timing: SendTiming): string {
  return timing === "schedule" ? "Campaign scheduled" : "Campaign queued";
}
```

- [ ] **Step 4: Run the tests and checks**

Run: `npx vitest run apps/web`
Expected: all pass.

Run: `npx tsc --noEmit -p apps/web` and `npm run lint -w apps/web`
Expected: exit 0; 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/campaignWizard.ts apps/web/src/lib/campaignWizard.test.ts
git commit -m "feat(web): add campaign wizard validation, payload and send-blocking logic

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Campaign list page and campaign mock API

**Files:**
- Create: `apps/web/src/lib/useCampaignDeliveries.ts`, `apps/web/src/components/campaigns/campaign-table.tsx`, `e2e/campaigns.spec.ts`
- Modify: `apps/web/src/app/(app)/businesses/[businessId]/campaigns/page.tsx` (full rewrite), `e2e/helpers/app.ts`

**Interfaces:**
- Consumes: Task 1 (`Campaign`, `CampaignAnalyticsResponse`, `CampaignDelivery`, `CAMPAIGNS_PAGE_SIZE`, `whenLabel`, `deliveryLabel`, `rowActionsFor`, `CampaignStatusBadge`, `channelLabel`, `campaignHref` from `lib/dashboard`), `paginate` from `lib/customers`.
- Produces:
  - `useCampaignDeliveries(businessId, campaigns): Record<string, CampaignDelivery>`.
  - `CampaignTable({ businessId, campaigns, deliveries, onEdit, onDelete })`.
  - e2e helper additions used by Tasks 4 and 5: `MockCampaign`, `campaign(id, title, overrides?, businessId?)`, `MockAnalytics`, and `mockApi` options `campaigns`, `analytics`, `failAnalyticsFor`, `queueError`; the returned `state` gains `campaigns: Record<string, MockCampaign[]>`.

- [ ] **Step 1: Extend the e2e helper**

In `e2e/helpers/app.ts`, add after the `customer(...)` function:

```ts
export type MockCampaign = {
  id: string;
  ownerId: string;
  businessId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS";
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  sendAt: string | null;
  targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
  createdAt: string;
  updatedAt: string;
};

export function campaign(
  id: string,
  title: string,
  overrides: Partial<MockCampaign> = {},
  businessId = "b1",
): MockCampaign {
  return {
    id,
    ownerId: "user-1",
    businessId,
    title,
    message: `Message for ${title}`,
    channel: "EMAIL",
    status: "DRAFT",
    sendAt: null,
    targetAudience: "ALL",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

export type MockAnalytics = Partial<{
  eligibleCount: number;
  sentCount: number;
  failedDeliveryCount: number;
  pendingCount: number;
  skippedBeforeSendCount: number;
}>;
```

Add to `ApiMockOptions`:

```ts
  /** Campaigns per business id. */
  campaigns?: Record<string, MockCampaign[]>;
  /** Delivery numbers per campaign id (missing fields are zero). */
  analytics?: Record<string, MockAnalytics>;
  /** Campaign ids whose analytics request fails with a 500. */
  failAnalyticsFor?: string[];
  /** Makes every queue request fail with this status and message. */
  queueError?: { status: number; error: string };
```

Add this function above `sleep`:

```ts
/** Mirrors the API's live eligibility for a draft (no snapshot yet). */
function previewFor(target: MockCampaign, customers: MockCustomer[]) {
  const results = customers.map((item) => {
    if (!item.emailOptIn || item.unsubscribedAt) {
      return {
        customerId: item.id,
        recipient: item.email,
        eligible: false,
        reason: item.unsubscribedAt ? "Customer has unsubscribed" : "Customer has not opted in to EMAIL",
      };
    }
    if (!item.email) {
      return {
        customerId: item.id,
        recipient: null,
        eligible: false,
        reason: "Customer has no EMAIL recipient",
      };
    }
    return { customerId: item.id, recipient: item.email, eligible: true, reason: null };
  });

  const eligible = results.filter((result) => result.eligible);
  const skipped = results.filter((result) => !result.eligible);
  const skippedByReason: Record<string, number> = {};
  for (const result of skipped) {
    const reason = result.reason ?? "Unknown reason";
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
  }

  return {
    campaign: {
      id: target.id,
      title: target.title,
      channel: target.channel,
      targetAudience: target.targetAudience,
      status: target.status,
    },
    summary: {
      totalCustomers: results.length,
      eligibleCount: eligible.length,
      skippedCount: skipped.length,
      skippedByReason,
      isSnapshot: false,
    },
    eligible,
    skipped,
  };
}
```

In `mockApi`, add to the `state` object:

```ts
    campaigns: Object.fromEntries(
      Object.entries(options.campaigns ?? {}).map(([id, list]) => [id, list.map((item) => ({ ...item }))]),
    ) as Record<string, MockCampaign[]>,
    nextCampaignId: 2000,
```

Replace the existing stub

```ts
    if (/^\/api\/businesses\/[^/]+\/campaigns$/.test(url.pathname)) {
      return json(200, []);
    }
```

with:

```ts
    const campaignRoute = url.pathname.match(
      /^\/api\/businesses\/([^/]+)\/campaigns(?:\/([^/]+))?(?:\/(analytics|preview|queue|logs))?$/,
    );
    if (campaignRoute) {
      const [, businessId, campaignId, action] = campaignRoute;
      const list = (state.campaigns[businessId] ??= []);
      const target = campaignId ? list.find((item) => item.id === campaignId) : undefined;
      const now = new Date().toISOString();

      if (!campaignId && request.method() === "GET") {
        return json(200, [...list]);
      }

      if (!campaignId && request.method() === "POST") {
        if (body?.channel === "SMS") {
          return json(422, {
            error: "SMS campaigns are temporarily disabled. Create an email campaign instead.",
          });
        }
        if (!String(body?.title ?? "").trim()) {
          return json(400, {
            error: "Invalid request body",
            details: [{ path: ["title"], message: "Campaign title is required" }],
          });
        }
        const created = campaign(
          `n-${state.nextCampaignId++}`,
          String(body?.title),
          {
            message: String(body?.message ?? ""),
            targetAudience: (body?.targetAudience as MockCampaign["targetAudience"]) ?? "ALL",
            sendAt: body?.sendAt ? String(body.sendAt) : null,
            createdAt: now,
            updatedAt: now,
          },
          businessId,
        );
        list.unshift(created);
        return json(201, created);
      }

      if (campaignId && !action && request.method() === "PUT") {
        if (!target || target.status !== "DRAFT" || target.channel !== "EMAIL") {
          return json(404, {
            error: "Campaign not found. Queued or sent campaigns cannot be edited.",
          });
        }
        target.title = String(body?.title);
        target.message = String(body?.message ?? "");
        target.targetAudience = (body?.targetAudience as MockCampaign["targetAudience"]) ?? "ALL";
        target.sendAt = body?.sendAt ? String(body.sendAt) : null;
        target.updatedAt = now;
        return json(200, target);
      }

      if (campaignId && !action && request.method() === "DELETE") {
        if (!target || target.status !== "DRAFT") {
          return json(404, {
            error: "Campaign not found. Queued or sent campaigns cannot be deleted.",
          });
        }
        state.campaigns[businessId] = list.filter((item) => item.id !== campaignId);
        return noContent();
      }

      if (campaignId && action === "analytics" && request.method() === "GET") {
        if (!target) {
          return json(404, { error: "Campaign not found" });
        }
        if (options.failAnalyticsFor?.includes(campaignId)) {
          return json(500, { error: "Analytics unavailable" });
        }
        const numbers = {
          eligibleCount: 0,
          sentCount: 0,
          failedDeliveryCount: 0,
          pendingCount: 0,
          skippedBeforeSendCount: 0,
          ...options.analytics?.[campaignId],
        };
        const attempted = numbers.sentCount + numbers.failedDeliveryCount + numbers.pendingCount;
        return json(200, {
          campaign: {
            id: target.id,
            title: target.title,
            channel: target.channel,
            targetAudience: target.targetAudience,
            status: target.status,
          },
          summary: {
            analyticsSource: "SNAPSHOT",
            hasSnapshot: true,
            totalSnapshotCount: numbers.eligibleCount + numbers.skippedBeforeSendCount,
            totalRecipientCount: numbers.eligibleCount + numbers.skippedBeforeSendCount,
            attemptedSendCount: attempted,
            totalLogCount: attempted,
            sentRate: attempted > 0 ? Math.round((numbers.sentCount / attempted) * 100) : null,
            skippedByReason: {},
            failedByReason: {},
            ...numbers,
          },
        });
      }

      if (campaignId && action === "preview" && request.method() === "GET") {
        return target
          ? json(200, previewFor(target, state.customers[businessId] ?? []))
          : json(404, { error: "Campaign not found" });
      }

      if (campaignId && action === "queue" && request.method() === "POST") {
        if (options.queueError) {
          return json(options.queueError.status, { error: options.queueError.error });
        }
        if (!target || target.status !== "DRAFT") {
          return json(404, { error: "Draft campaign not found or campaign is already queued/sent" });
        }
        const eligibleCount = previewFor(target, state.customers[businessId] ?? []).summary
          .eligibleCount;
        if (eligibleCount === 0) {
          return json(409, { error: "This campaign has no eligible, opted-in email recipients." });
        }
        if (eligibleCount > 10) {
          return json(409, {
            error: "Campaigns are limited to 10 recipients. Narrow the audience before sending.",
            eligibleCount,
            maxRecipients: 10,
          });
        }
        target.status = "QUEUED";
        target.updatedAt = now;
        return json(200, {
          message: target.sendAt ? "Campaign scheduled successfully" : "Campaign queued successfully",
          campaignId,
          delay: 0,
          scheduledFor: target.sendAt,
        });
      }
    }
```

- [ ] **Step 2: Write the delivery hook**

Create `apps/web/src/lib/useCampaignDeliveries.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiClient";
import type { CampaignDelivery } from "./campaignDisplay";
import type { Campaign, CampaignAnalyticsResponse } from "./types";

/**
 * Delivery numbers for the non-draft campaigns on screen. Each request is independent, so one
 * failure only marks its own row as unavailable. Drafts never trigger a request.
 */
export function useCampaignDeliveries(
  businessId: string,
  campaigns: Array<Pick<Campaign, "id" | "status">>,
): Record<string, CampaignDelivery> {
  const [deliveries, setDeliveries] = useState<Record<string, CampaignDelivery>>({});
  // The status is part of the key so a campaign that finishes sending is fetched again.
  const wanted = campaigns
    .filter((item) => item.status !== "DRAFT")
    .map((item) => `${item.id}:${item.status}`)
    .join(",");

  useEffect(() => {
    if (!wanted) {
      return;
    }
    const ids = wanted.split(",").map((entry) => entry.split(":")[0]);
    const controller = new AbortController();

    setDeliveries((previous) => {
      const next = { ...previous };
      for (const id of ids) {
        next[id] = previous[id] ?? { status: "loading" };
      }
      return next;
    });

    Promise.allSettled(
      ids.map((id) =>
        apiFetch<CampaignAnalyticsResponse>(
          `/api/businesses/${businessId}/campaigns/${id}/analytics`,
          { signal: controller.signal },
        ),
      ),
    ).then((results) => {
      if (controller.signal.aborted) {
        return;
      }
      setDeliveries((previous) => {
        const next = { ...previous };
        results.forEach((result, index) => {
          next[ids[index]] =
            result.status === "fulfilled"
              ? { status: "ready", summary: result.value.summary }
              : { status: "error" };
        });
        return next;
      });
    });

    return () => controller.abort();
  }, [businessId, wanted]);

  return deliveries;
}
```

- [ ] **Step 3: Write the table component**

Create `apps/web/src/components/campaigns/campaign-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  deliveryLabel,
  rowActionsFor,
  whenLabel,
  type CampaignDelivery,
} from "@/lib/campaignDisplay";
import { channelLabel } from "@/lib/campaignStatus";
import { campaignHref } from "@/lib/dashboard";
import type { Campaign } from "@/lib/types";

type Handlers = {
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
};

function RowActions({ campaign, onEdit, onDelete }: { campaign: Campaign } & Handlers) {
  const actions = rowActionsFor(campaign);
  if (actions.length === 0) {
    return null;
  }

  const items: MenuItem[] = actions.map((action) =>
    action === "edit"
      ? { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: () => onEdit(campaign) }
      : {
          id: "delete",
          label: "Delete",
          icon: <Icon name="trash" />,
          onSelect: () => onDelete(campaign),
        },
  );

  return (
    <Menu
      align="end"
      items={items}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`Actions for ${campaign.title}`}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
        >
          <Icon name="more" />
        </button>
      )}
    />
  );
}

function NameCell({ businessId, campaign }: { businessId: string; campaign: Campaign }) {
  return (
    <div className="min-w-0">
      <Link
        href={campaignHref(businessId, campaign)}
        title={campaign.title}
        className="inline-flex min-h-10 max-w-full items-center font-medium text-ink hover:underline lg:min-h-9"
      >
        <span className="truncate">{campaign.title}</span>
      </Link>
      {campaign.channel === "SMS" ? (
        <p className="text-xs text-muted">SMS sending is paused</p>
      ) : null}
    </div>
  );
}

/** A table from `xl` up; stacked cards below, where six columns would be cramped. */
export function CampaignTable({
  businessId,
  campaigns,
  deliveries,
  onEdit,
  onDelete,
}: {
  businessId: string;
  campaigns: Campaign[];
  deliveries: Record<string, CampaignDelivery>;
} & Handlers) {
  return (
    <>
      <div className="hidden xl:block">
        <Table caption="Campaigns" fixed>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th className="w-24">Channel</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-48">When</Th>
              <Th className="w-56">Delivery</Th>
              <Th className="w-[4.5rem]">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {campaigns.map((campaign) => (
              <Tr key={campaign.id}>
                <Td className="overflow-hidden">
                  <NameCell businessId={businessId} campaign={campaign} />
                </Td>
                <Td>
                  <Badge>{channelLabel(campaign.channel)}</Badge>
                </Td>
                <Td>
                  <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
                </Td>
                <Td className="text-muted">{whenLabel(campaign)}</Td>
                <Td className="text-muted">{deliveryLabel(campaign, deliveries[campaign.id])}</Td>
                <Td className="text-right">
                  <RowActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="space-y-2 xl:hidden">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded-container border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <NameCell businessId={businessId} campaign={campaign} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
                  <Badge>{channelLabel(campaign.channel)}</Badge>
                </div>
              </div>
              <div className="-mr-2 -mt-2">
                <RowActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-ink">When</dt>
                <dd className="text-muted">{whenLabel(campaign)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-ink">Delivery</dt>
                <dd className="text-muted">{deliveryLabel(campaign, deliveries[campaign.id])}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 4: Rewrite the page**

Replace `apps/web/src/app/(app)/businesses/[businessId]/campaigns/page.tsx` entirely with:

```tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import { CAMPAIGNS_PAGE_SIZE } from "@/lib/campaignDisplay";
import { paginate } from "@/lib/customers";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useCampaignDeliveries } from "@/lib/useCampaignDeliveries";

export default function CampaignsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so the page, an open dialog and the page number reset when the business changes.
  return <CampaignsView key={businessId} businessId={businessId} />;
}

function CampaignsView({ businessId }: { businessId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const newHref = `/businesses/${businessId}/campaigns/new`;
  const { data, error, slow, refetch } = useApi<Campaign[]>(
    `/api/businesses/${businessId}/campaigns`,
  );

  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const campaigns = data ?? [];
  const visible = paginate(campaigns, page, CAMPAIGNS_PAGE_SIZE);
  const deliveries = useCampaignDeliveries(businessId, visible.items);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns" },
        ]}
        title="Campaigns"
        description="Write, schedule and review the emails you send to your customers."
        actions={
          <Link href={newHref} className={buttonClasses({ variant: "primary" })}>
            <Icon name="plus" />
            New campaign
          </Link>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load campaigns" message={error.message} onRetry={refetch} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="send"
          title="No campaigns yet"
          description="Write your first email campaign and send it to customers who agreed to hear from you."
          action={
            <Link href={newHref} className={buttonClasses({ variant: "primary" })}>
              Create your first campaign
            </Link>
          }
        />
      ) : (
        <>
          <CampaignTable
            businessId={businessId}
            campaigns={visible.items}
            deliveries={deliveries}
            onEdit={(campaign) =>
              router.push(`/businesses/${businessId}/campaigns/${campaign.id}/edit`)
            }
            onDelete={setDeleting}
          />
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

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.title ?? "this campaign"}”?`}
        description="This removes the draft. This can’t be undone."
        confirmLabel="Delete campaign"
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${businessId}/campaigns/${deleting.id}`, {
            method: "DELETE",
          });
          refetch();
          toast.success("Campaign deleted");
        }}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 5: Write the e2e tests**

Create `e2e/campaigns.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { business, campaign, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const draft = campaign("k-1", "Spring menu");
const scheduled = campaign("k-2", "Holiday preview", {
  status: "QUEUED",
  sendAt: "2099-12-01T12:00:00.000Z",
});
const waiting = campaign("k-3", "Weekend offer", { status: "QUEUED" });
const sent = campaign("k-4", "Loyalty thanks", {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
});
const failed = campaign("k-5", "Autumn tasting", {
  status: "FAILED",
  updatedAt: "2026-09-28T08:00:00.000Z",
});
const legacySms = campaign("k-6", "Text blast", { channel: "SMS" });

const analytics = {
  "k-2": { eligibleCount: 5 },
  "k-3": { eligibleCount: 3, pendingCount: 2, sentCount: 1 },
  "k-4": { eligibleCount: 4, sentCount: 3, failedDeliveryCount: 1 },
  "k-5": { eligibleCount: 2, failedDeliveryCount: 2 },
};

test.describe("campaign list", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("shows status, when and delivery for every campaign", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, scheduled, waiting, sent, failed, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("heading", { level: 1, name: "Campaigns" })).toBeVisible();
    const row = (name: RegExp) => page.getByRole("row", { name });

    await expect(row(/Spring menu/)).toContainText("Draft");
    await expect(row(/Spring menu/)).toContainText("Not sent yet");
    await expect(row(/Holiday preview/)).toContainText("Scheduled");
    await expect(row(/Holiday preview/)).toContainText("2099");
    await expect(row(/Weekend offer/)).toContainText("Queued");
    await expect(row(/Weekend offer/)).toContainText("Waiting to be sent");
    await expect(row(/Weekend offer/)).toContainText("1 of 3 sent, 2 pending");
    await expect(row(/Loyalty thanks/)).toContainText("Sent");
    await expect(row(/Loyalty thanks/)).toContainText("3 of 4 sent, 1 failed");
    await expect(row(/Autumn tasting/)).toContainText("Failed");
    await expect(row(/Autumn tasting/)).toContainText("0 of 2 sent, 2 failed");
    await expect(row(/Text blast/)).toContainText("SMS sending is paused");
    await expect(row(/Text blast/)).toContainText("SMS");
  });

  test("asks for delivery numbers only for campaigns that are not drafts", async ({ page }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, sent, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");
    await expect(page.getByRole("row", { name: /Loyalty thanks/ })).toContainText("3 of 4 sent");

    const analyticsPaths = state.requests
      .filter((request) => request.path.endsWith("/analytics"))
      .map((request) => request.path);
    expect(analyticsPaths).toEqual(["/api/businesses/b1/campaigns/k-4/analytics"]);
  });

  test("one failing delivery request leaves the other rows intact", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent, failed] },
      analytics,
      failAnalyticsFor: ["k-4"],
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("row", { name: /Loyalty thanks/ })).toContainText("Unavailable");
    await expect(page.getByRole("row", { name: /Autumn tasting/ })).toContainText(
      "0 of 2 sent, 2 failed",
    );
  });

  test("offers row actions only where they apply, and deletes a draft after confirming", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [draft, sent, legacySms] },
      analytics,
    });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("button", { name: "Actions for Loyalty thanks" })).toHaveCount(0);

    await page.getByRole("button", { name: "Actions for Text blast" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Actions for Spring menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete campaign" }).click();

    await expect(page.getByText("Campaign deleted")).toBeVisible();
    await expect(page.getByRole("row", { name: /Spring menu/ })).toHaveCount(0);
    expect(
      state.requests.some(
        (request) =>
          request.method === "DELETE" && request.path === "/api/businesses/b1/campaigns/k-1",
      ),
    ).toBe(true);
  });

  test("links each row to its detail page and offers the wizard when empty", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] }, analytics });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("link", { name: "Spring menu" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/preview",
    );
    await expect(page.getByRole("link", { name: "Loyalty thanks" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-4/analytics",
    );
    await expect(page.getByRole("link", { name: "New campaign" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/new",
    );
  });

  test("shows an empty state with a link to create the first campaign", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [] } });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("heading", { name: "No campaigns yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create your first campaign" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/new",
    );
  });

  test("uses stacked cards instead of a table on narrower screens", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] }, analytics });
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/businesses/b1/campaigns");

    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "Loyalty thanks" });
    await expect(card).toContainText("Sent");
    await expect(card).toContainText("3 of 4 sent, 1 failed");
  });
});
```

- [ ] **Step 6: Run everything**

Run: `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`
Expected: exit 0; 0 lint errors.

Run: `npx playwright test e2e/campaigns.spec.ts` then `git checkout -- playwright-report test-results`
Expected: 7 passed. If a test fails because of a mock or locator detail, fix the helper or locator; never weaken what a test asserts.

Run: `npx playwright test` then `git checkout -- playwright-report test-results`
Expected: 54 passed (47 existing plus 7); the dashboard tests still pass because nothing they touch changed.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e/helpers/app.ts e2e/campaigns.spec.ts
git commit -m "feat(web): redesign the Campaigns list with status, schedule and delivery

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wizard shell, steps 1 to 3 and the read-only Review step

**Files:**
- Create: `apps/web/src/components/campaigns/email-preview.tsx`, `apps/web/src/components/campaigns/wizard/{stepper,step-basics,step-recipients,step-message,recipient-summary,step-review,campaign-wizard}.tsx`, `apps/web/src/app/(app)/businesses/[businessId]/campaigns/new/page.tsx`, `apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]/edit/page.tsx`, `e2e/campaign-wizard.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3 (`WIZARD_STEPS`, `WizardValues`, `wizardValues`, `validateStep`, `canSaveDraft`, `campaignPayload`, `editBlockReason`, `skippedReasons`, `pluralize`, `CAMPAIGN_LIMITS`, `Campaign`, `CampaignPreviewResponse`, `DashboardResponse`, mock helper).
- Produces:
  - `CampaignWizard({ businessId, businessName, campaign })` (`campaign: Campaign | null`; null creates).
  - `PreviewState` type and `RecipientSummary({ preview })` in `recipient-summary.tsx`.
  - `StepReview({ values, businessName, preview })` (Task 5 replaces this file).
  - Wizard internals Task 5 extends: state `values`, `errors`, `formError`, `stepIndex`, `draftId`, `busy`; refs `inFlight`, `formRef`; functions `setField`, `persistDraft`, `reportSaveError`, `handleSubmit`, `handleSaveDraft`.

- [ ] **Step 1: Stepper and email preview**

Create `apps/web/src/components/campaigns/wizard/stepper.tsx`:

```tsx
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Which step the user is on, and which are done. State is shown with a number, a check and text. */
export function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: ReadonlyArray<{ id: string; label: string }>;
  currentIndex: number;
}) {
  return (
    <ol aria-label="Campaign steps" className="flex flex-wrap gap-x-6 gap-y-2">
      {steps.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";

        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex items-center gap-2 text-[13px]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                state === "done" && "border-success bg-success-soft text-success",
                state === "current" && "border-accent bg-accent text-accent-ink",
                state === "todo" && "border-line-strong text-muted",
              )}
            >
              {state === "done" ? <Icon name="check" className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn(state === "current" ? "font-medium text-ink" : "text-muted")}>
              {step.label}
              {state === "done" ? <span className="sr-only"> (completed)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

Create `apps/web/src/components/campaigns/email-preview.tsx`:

```tsx
/** What the customer will roughly see. The subject is the campaign name; an unsubscribe link is always added. */
export function EmailPreview({
  businessName,
  subject,
  message,
}: {
  businessName: string;
  subject: string;
  message: string;
}) {
  return (
    <section aria-labelledby="email-preview-heading" className="space-y-2">
      <h3 id="email-preview-heading" className="text-[13px] font-medium text-ink">
        Email preview
      </h3>
      <div className="overflow-hidden rounded-container border border-line bg-canvas">
        <dl className="space-y-1 border-b border-line bg-surface px-4 py-3 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">From</dt>
            <dd className="min-w-0 truncate text-ink">{businessName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-muted">Subject</dt>
            <dd className="min-w-0 break-words font-medium text-ink">
              {subject.trim() || <span className="font-normal text-muted">Your campaign name</span>}
            </dd>
          </div>
        </dl>
        <div className="px-4 py-4 text-sm text-ink">
          {message.trim() ? (
            <p className="whitespace-pre-wrap break-words">{message}</p>
          ) : (
            <p className="text-muted">Your message will appear here.</p>
          )}
        </div>
        <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
          Every email includes an unsubscribe link.
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Steps 1 to 3**

Create `apps/web/src/components/campaigns/wizard/step-basics.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { TextField } from "@/components/ui/field";

export function StepBasics({
  title,
  error,
  onChange,
}: {
  title: string;
  error: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <TextField
        label="Campaign name"
        required
        autoComplete="off"
        hint="Customers see this as the email subject."
        value={title}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium text-ink">Channel</p>
        <p>
          <Badge icon="send">Email</Badge>
        </p>
        <p className="text-xs text-muted">Campaigns are sent by email.</p>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/campaigns/wizard/step-recipients.tsx`:

```tsx
import Link from "next/link";
import { SlowNotice } from "@/components/ui/state";
import { CAMPAIGN_LIMITS } from "@/lib/campaignLimits";
import { pluralize } from "@/lib/format";

export function StepRecipients({
  businessId,
  optedInCount,
  loading,
  slow,
  failed,
}: {
  businessId: string;
  /** Customers who agreed to receive emails; null until the dashboard request answers. */
  optedInCount: number | null;
  loading: boolean;
  slow: boolean;
  failed: boolean;
}) {
  const { maxRecipientsPerCampaign, maxEmailsPerRecipientPer24Hours } = CAMPAIGN_LIMITS;

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink">
        Your campaign goes to customers who agreed to receive promotional emails, have an email
        address and haven’t unsubscribed. You don’t need to choose an audience.
      </p>

      <div aria-live="polite" className="space-y-2">
        {loading ? (
          <>
            <p className="text-sm text-muted">Counting your customers…</p>
            {slow ? <SlowNotice /> : null}
          </>
        ) : failed || optedInCount === null ? (
          <p className="text-sm text-muted">
            We couldn’t load your customer count. You’ll see exactly who receives the campaign on
            the last step.
          </p>
        ) : optedInCount === 0 ? (
          <div className="rounded-control border border-warning bg-warning-soft px-3 py-2.5 text-sm">
            <p className="font-medium text-warning">No customers have agreed to receive emails yet</p>
            <p className="mt-0.5 text-ink">
              You can still write this campaign, but it can’t be sent until a customer opts in.{" "}
              <Link
                href={`/businesses/${businessId}/customers`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline"
              >
                Add customers (opens in a new tab)
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink">
            <span className="font-semibold">{pluralize(optedInCount, "customer")}</span>{" "}
            {optedInCount === 1 ? "has" : "have"} agreed to receive emails. The exact list, minus
            anyone without an email address, is checked on the last step.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-[13px] font-medium text-ink">Sending limits</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
          <li>Up to {maxRecipientsPerCampaign} recipients per campaign.</li>
          <li>
            Each customer can receive {maxEmailsPerRecipientPer24Hours === 1 ? "one" : maxEmailsPerRecipientPer24Hours}{" "}
            campaign email per 24 hours.
          </li>
        </ul>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/campaigns/wizard/step-message.tsx`:

```tsx
import { EmailPreview } from "@/components/campaigns/email-preview";
import { TextAreaField } from "@/components/ui/field";

export function StepMessage({
  title,
  message,
  error,
  businessName,
  onChange,
}: {
  title: string;
  message: string;
  error: string | undefined;
  businessName: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TextAreaField
        label="Message"
        required
        rows={10}
        className="min-h-48"
        hint={`${message.length} characters. Line breaks are kept.`}
        value={message}
        onChange={(event) => onChange(event.target.value)}
        error={error}
      />
      <EmailPreview businessName={businessName} subject={title} message={message} />
    </div>
  );
}
```

- [ ] **Step 3: Recipient summary and the Review step (read-only for now)**

Create `apps/web/src/components/campaigns/wizard/recipient-summary.tsx`:

```tsx
import { Button } from "@/components/ui/button";
import { SlowNotice } from "@/components/ui/state";
import type { ApiError } from "@/lib/apiClient";
import { skippedReasons } from "@/lib/campaignDisplay";
import { pluralize } from "@/lib/format";
import type { CampaignPreviewResponse } from "@/lib/types";

export type PreviewState = {
  data: CampaignPreviewResponse | null;
  error: ApiError | null;
  loading: boolean;
  slow: boolean;
  refetch: () => void;
};

/** Exact recipients from the API's preview: who will receive the campaign and who is skipped, and why. */
export function RecipientSummary({ preview }: { preview: PreviewState }) {
  const { data, error, slow, refetch } = preview;

  return (
    <section aria-labelledby="recipients-summary-heading" className="space-y-3">
      <h3 id="recipients-summary-heading" className="text-sm font-semibold text-ink">
        Who will receive it
      </h3>

      <div aria-live="polite">
        {data ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              <span className="text-2xl font-semibold">{data.summary.eligibleCount}</span>{" "}
              {data.summary.eligibleCount === 1 ? "customer" : "customers"} will receive this
              campaign
            </p>

            {data.summary.skippedCount > 0 ? (
              <div>
                <p className="text-sm text-muted">
                  {pluralize(data.summary.skippedCount, "customer")} will be skipped:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
                  {skippedReasons(data.summary.skippedByReason).map((reason) => (
                    <li key={reason.label}>
                      {reason.label}: {reason.count}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">
              Couldn’t check who will receive this campaign. {error.message}
            </p>
            <Button onClick={refetch}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted">Checking who can receive this campaign…</p>
            {slow ? <SlowNotice /> : null}
          </div>
        )}
      </div>
    </section>
  );
}
```

Create `apps/web/src/components/campaigns/wizard/step-review.tsx`:

```tsx
import { RecipientSummary, type PreviewState } from "./recipient-summary";
import type { WizardValues } from "@/lib/campaignWizard";

export function StepReview({
  values,
  preview,
}: {
  values: WizardValues;
  preview: PreviewState;
}) {
  return (
    <div className="space-y-6">
      <p className="rounded-control border border-line bg-sunken px-3 py-2 text-sm text-muted">
        We saved this campaign as a draft so we can check exactly who will receive it. It stays
        under Campaigns until you send or delete it.
      </p>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[13px] font-medium text-ink">Subject</dt>
          <dd className="mt-0.5 break-words text-ink">{values.title.trim()}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-medium text-ink">Message</dt>
          <dd className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-muted">
            {values.message.trim()}
          </dd>
        </div>
      </dl>

      <RecipientSummary preview={preview} />
    </div>
  );
}
```

- [ ] **Step 4: The wizard component**

Create `apps/web/src/components/campaigns/wizard/campaign-wizard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StepBasics } from "./step-basics";
import { StepMessage } from "./step-message";
import { StepRecipients } from "./step-recipients";
import { StepReview } from "./step-review";
import { WizardStepper } from "./stepper";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import {
  campaignPayload,
  canSaveDraft,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardStepId,
  type WizardValues,
} from "@/lib/campaignWizard";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Campaign, CampaignPreviewResponse, DashboardResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/** Server field errors belong to the step that shows the field. */
const FIELD_STEP: Record<string, WizardStepId> = { title: "basics", message: "message" };

export function CampaignWizard({
  businessId,
  businessName,
  campaign,
}: {
  businessId: string;
  businessName: string;
  /** The draft being edited, or null to create a new campaign. */
  campaign: Campaign | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const listHref = `/businesses/${businessId}/campaigns`;

  const [values, setValues] = useState<WizardValues>(() => wizardValues(campaign));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(campaign?.id ?? null);
  const [busy, setBusy] = useState<"draft" | "review" | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(stepIndex);

  const step = WIZARD_STEPS[stepIndex].id;
  const isReview = step === "review";

  const dashboard = useApi<DashboardResponse>(`/api/businesses/${businessId}/dashboard`);
  const preview = useApi<CampaignPreviewResponse>(
    isReview && draftId ? `/api/businesses/${businessId}/campaigns/${draftId}/preview` : null,
  );

  // Move focus to the new step's heading for keyboard and screen-reader users (not on first render).
  useEffect(() => {
    if (shownStep.current === stepIndex) {
      return;
    }
    shownStep.current = stepIndex;
    headingRef.current?.focus();
  }, [stepIndex]);

  function setField<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  /** Creates the draft on first save, updates it afterwards. */
  async function persistDraft(): Promise<string> {
    const base = `/api/businesses/${businessId}/campaigns`;
    const saved = await apiFetch<Campaign>(draftId ? `${base}/${draftId}` : base, {
      method: draftId ? "PUT" : "POST",
      body: campaignPayload(values),
    });
    setDraftId(saved.id);
    return saved.id;
  }

  function reportSaveError(error: unknown) {
    const { fields, unmapped } = splitFieldErrors(fieldErrorsFromApiError(error), ["title", "message"]);
    const fieldNames = Object.keys(fields);

    if (fieldNames.length > 0) {
      setErrors(fields);
      const owner = FIELD_STEP[fieldNames[0]];
      const index = WIZARD_STEPS.findIndex((item) => item.id === owner);
      if (index >= 0) {
        setStepIndex(index);
      }
      focusFirstInvalid(formRef.current);
    }
    if (unmapped.length > 0) {
      setFormError(unmapped.join(" "));
    } else if (fieldNames.length === 0) {
      setFormError(
        error instanceof ApiError ? error.message : "Could not save the campaign. Try again.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || isReview) {
      return;
    }

    setFormError(null);
    const stepErrors = validateStep(step, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setErrors({});

    if (step === "message") {
      // Entering Review creates or updates the draft so the API can compute exact recipients.
      inFlight.current = true;
      setBusy("review");
      try {
        await persistDraft();
        setStepIndex((index) => index + 1);
      } catch (error) {
        reportSaveError(error);
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
      return;
    }

    setStepIndex((index) => index + 1);
  }

  async function handleSaveDraft() {
    if (inFlight.current || !canSaveDraft(values)) {
      return;
    }
    inFlight.current = true;
    setBusy("draft");
    setFormError(null);
    try {
      await persistDraft();
      toast.success("Draft saved");
      router.push(listHref);
    } catch (error) {
      reportSaveError(error);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  function handleBack() {
    setFormError(null);
    setErrors({});
    setStepIndex((index) => Math.max(0, index - 1));
  }

  const optedIn = dashboard.data?.summary.customers.emailOptedIn ?? null;

  return (
    <div>
      <WizardStepper steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <section
          aria-labelledby="wizard-step-heading"
          className="rounded-container border border-line bg-surface p-5 sm:p-6"
        >
          <p className="text-[13px] text-muted">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </p>
          <h2
            id="wizard-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mb-4 text-base font-semibold text-ink focus:outline-none"
          >
            {WIZARD_STEPS[stepIndex].label}
          </h2>

          {step === "basics" ? (
            <StepBasics
              title={values.title}
              error={errors.title}
              onChange={(value) => setField("title", value)}
            />
          ) : step === "recipients" ? (
            <StepRecipients
              businessId={businessId}
              optedInCount={optedIn}
              loading={dashboard.loading}
              slow={dashboard.slow}
              failed={dashboard.error !== null}
            />
          ) : step === "message" ? (
            <StepMessage
              title={values.title}
              message={values.message}
              error={errors.message}
              businessName={businessName}
              onChange={(value) => setField("message", value)}
            />
          ) : (
            <StepReview values={values} preview={preview} />
          )}
        </section>

        {formError ? <FormError message={formError} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={handleBack} disabled={busy !== null}>
              Back
            </Button>
          ) : (
            <Link href={listHref} className={buttonClasses({ variant: "ghost" })}>
              Cancel
            </Link>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              loading={busy === "draft"}
              disabled={busy === "review" || !canSaveDraft(values)}
            >
              Save draft
            </Button>
            {!isReview ? (
              <Button
                type="submit"
                variant="primary"
                loading={busy === "review"}
                disabled={busy === "draft"}
              >
                {step === "message" ? "Review" : "Continue"}
              </Button>
            ) : null}
          </div>
        </div>

        {!canSaveDraft(values) ? (
          <p className="text-right text-[13px] text-muted">
            Save draft is available once the campaign has a name and a message.
          </p>
        ) : null}
      </form>
    </div>
  );
}
```

- [ ] **Step 5: The two pages**

Create `apps/web/src/app/(app)/businesses/[businessId]/campaigns/new/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { PageContainer, PageHeader } from "@/components/ui/page-header";

export default function NewCampaignPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so a half-written campaign never leaks into another business.
  return <NewCampaignView key={businessId} businessId={businessId} />;
}

function NewCampaignView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: `/businesses/${businessId}/campaigns` },
          { label: "New campaign" },
        ]}
        title="New campaign"
        description="Write a message and send it to customers who agreed to hear from you."
      />
      <CampaignWizard businessId={businessId} businessName={businessName} campaign={null} />
    </PageContainer>
  );
}
```

Create `apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]/edit/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { editBlockReason } from "@/lib/campaignDisplay";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function EditCampaignPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  return <EditCampaignView key={`${businessId}/${campaignId}`} businessId={businessId} campaignId={campaignId} />;
}

function EditCampaignView({ businessId, campaignId }: { businessId: string; campaignId: string }) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const listHref = `/businesses/${businessId}/campaigns`;
  // The API has no single-campaign endpoint, so read the list and find the campaign.
  const { data, error, slow, refetch } = useApi<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
  const campaign = data?.find((item) => item.id === campaignId) ?? null;
  const blockReason = campaign ? editBlockReason(campaign) : null;

  const backLink = (
    <Link href={listHref} className={buttonClasses({ variant: "primary" })}>
      Back to campaigns
    </Link>
  );

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: listHref },
          { label: "Edit campaign" },
        ]}
        title="Edit campaign"
        description="Changes are saved to the draft. Nothing is sent until you confirm on the last step."
      />

      {data === null && error === null ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load the campaign" message={error.message} onRetry={refetch} />
      ) : !campaign ? (
        <EmptyState
          title="Campaign not found"
          description="This campaign doesn’t exist or was deleted."
          action={backLink}
        />
      ) : blockReason ? (
        <EmptyState icon="alert" title="This campaign can’t be edited" description={blockReason} action={backLink} />
      ) : (
        <CampaignWizard
          key={campaign.id}
          businessId={businessId}
          businessName={businessName}
          campaign={campaign}
        />
      )}
    </PageContainer>
  );
}
```

- [ ] **Step 6: Write the e2e tests**

Create `e2e/campaign-wizard.spec.ts`:

```ts
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
    await page.getByLabel("Message").fill(" \n ");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("Write the message your customers will read.")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeFocused();

    await page.getByLabel("Message").fill("Fresh pumpkin loaves are in.\nCome say hi.");
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
    await page.getByLabel("Message").fill("Fresh loaves.");
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
    await page.getByLabel("Message").fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeFocused();
    await expect(page.getByText(/We saved this campaign as a draft/)).toBeVisible();
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();
    await expect(page.getByText("2 customers will be skipped:")).toBeVisible();
    await expect(page.getByText("Hasn’t agreed to receive emails: 1")).toBeVisible();
    await expect(page.getByText("No email address: 1")).toBeVisible();

    // Going back and returning updates the same draft instead of creating another.
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByLabel("Message").fill("Fresh loaves, baked this morning.");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("baked this morning.")).toBeVisible();

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
    await page.getByLabel("Message").fill("Fresh loaves.");

    await page.getByRole("button", { name: "Review" }).dblclick();
    await expect(page.getByRole("heading", { level: 2, name: "Review and send" })).toBeVisible();

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
    await page.getByLabel("Message").fill("Fresh loaves.");
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
    await expect(page.getByLabel("Message")).toHaveValue("Blossom buns are back.");

    await page.getByLabel("Message").fill("Blossom buns are back, with jam.");
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
```

- [ ] **Step 7: Run everything**

Run: `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`
Expected: exit 0; 0 lint errors.

Run: `npx playwright test e2e/campaign-wizard.spec.ts e2e/campaigns.spec.ts` then `git checkout -- playwright-report test-results`
Expected: all pass. Fix helper or locator details if needed, but never weaken an assertion. Known risks to check first if something fails: the label text of `getByLabel("Message")` could also match another element (use `{ exact: true }` on the label, not by dropping the assertion); `getByRole("region", { name: "Email preview" })` needs the `<section aria-labelledby>` to be a labelled region (it is).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src e2e/campaign-wizard.spec.ts
git commit -m "feat(web): add the guided campaign wizard (basics, recipients, message, review)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Review step, send flow and failure handling

**Files:**
- Modify: `apps/web/src/components/campaigns/wizard/step-review.tsx` (full replacement), `apps/web/src/components/campaigns/wizard/campaign-wizard.tsx`, `e2e/helpers/app.ts` (`signIn` option), `e2e/campaign-wizard.spec.ts` (append)
- Create: `apps/web/src/components/campaigns/wizard/send-confirm-dialog.tsx`

**Interfaces:**
- Consumes: Task 4's wizard internals (`values`, `errors`, `formError`, `stepIndex`, `draftId`, `busy`, `inFlight`, `formRef`, `setField`, `handleSubmit`, `preview`), Task 2 (`sendBlocks`, `confirmCopy`, `submitLabel`, `successMessage`, `validateStep`, `campaignPayload`), Task 1 (`formatDateTime`, `localInputToIso`, `toLocalInput`, `localTimeZoneLabel`), `useSession`.
- Produces: the finished wizard. `signIn(page, { emailConfirmed?: boolean })` in the e2e helper.

- [ ] **Step 1: Confirm dialog**

Create `apps/web/src/components/campaigns/wizard/send-confirm-dialog.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Asks for the final confirmation. It holds no error state: a refused send closes it and the
 * wizard shows the server's message in a panel on the Review step, where it stays.
 */
export function SendConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  sending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!sending}
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={sending} data-autofocus="true">
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={sending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2: Replace the Review step**

Replace `apps/web/src/components/campaigns/wizard/step-review.tsx` entirely with:

```tsx
import { type RefObject } from "react";
import { RecipientSummary, type PreviewState } from "./recipient-summary";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { SendBlock, WizardValues } from "@/lib/campaignWizard";
import { localTimeZoneLabel, toLocalInput } from "@/lib/schedule";

function TimingOption({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-control py-1 text-sm font-medium text-ink"
      >
        <input
          id={id}
          type="radio"
          name="timing"
          checked={checked}
          onChange={onChange}
          aria-describedby={`${id}-hint`}
          className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
        />
        {label}
      </label>
      <p id={`${id}-hint`} className="pl-8 text-xs text-muted">
        {hint}
      </p>
    </div>
  );
}

export function StepReview({
  values,
  errors,
  onChange,
  preview,
  blocks,
  sendError,
  sendErrorRef,
  onRecheck,
}: {
  values: WizardValues;
  errors: Record<string, string>;
  onChange: <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => void;
  preview: PreviewState;
  blocks: SendBlock[];
  sendError: string | null;
  sendErrorRef: RefObject<HTMLDivElement | null>;
  onRecheck: () => void;
}) {
  const canRecheck = blocks.some((block) => block.code !== "email-unconfirmed");

  return (
    <div className="space-y-6">
      <p className="rounded-control border border-line bg-sunken px-3 py-2 text-sm text-muted">
        We saved this campaign as a draft so we can check exactly who will receive it. It stays
        under Campaigns until you send or delete it.
      </p>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[13px] font-medium text-ink">Subject</dt>
          <dd className="mt-0.5 break-words text-ink">{values.title.trim()}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-medium text-ink">Message</dt>
          <dd className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-muted">
            {values.message.trim()}
          </dd>
        </div>
      </dl>

      <RecipientSummary preview={preview} />

      <div aria-live="polite" className="space-y-2">
        {blocks.map((block) => (
          <div
            key={block.code}
            className="rounded-control border border-warning bg-warning-soft px-3 py-2.5 text-sm"
          >
            <p className="font-medium text-warning">{block.title}</p>
            <p className="mt-0.5 text-ink">{block.message}</p>
          </div>
        ))}
        {canRecheck ? <Button onClick={onRecheck}>Check again</Button> : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-ink">When should it go out?</legend>
        <TimingOption
          id="timing-now"
          label="Send now"
          hint="It’s queued as soon as you confirm."
          checked={values.timing === "now"}
          onChange={() => onChange("timing", "now")}
        />
        <TimingOption
          id="timing-schedule"
          label="Schedule for later"
          hint="Choose a date and time in the future."
          checked={values.timing === "schedule"}
          onChange={() => onChange("timing", "schedule")}
        />
        {values.timing === "schedule" ? (
          <div className="pl-8">
            <TextField
              label="Date and time"
              type="datetime-local"
              required
              min={toLocalInput(new Date().toISOString())}
              value={values.scheduledAt}
              onChange={(event) => onChange("scheduledAt", event.target.value)}
              error={errors.scheduledAt}
              hint={`Times are shown in your time zone (${localTimeZoneLabel()}).`}
            />
          </div>
        ) : null}
      </fieldset>

      {sendError ? (
        <div
          ref={sendErrorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-control border border-danger bg-danger-soft px-3 py-2.5 text-sm focus:outline-none"
        >
          <p className="font-medium text-danger">The campaign wasn’t sent</p>
          <p className="mt-0.5 text-ink">{sendError}</p>
          <p className="mt-1 text-muted">
            Your draft is saved. Fix the problem and try again, or save the draft and come back
            later.
          </p>
        </div>
      ) : null}

      <p className="text-[13px] text-muted">
        Delivery happens in the background, and daily sending limits may mark some recipients as
        failed. You’ll see the results on the next screen.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Extend the wizard**

Apply these edits to `apps/web/src/components/campaigns/wizard/campaign-wizard.tsx`.

1. Imports. Add `useSession` and the dialog, and extend the lib imports:

```tsx
import { SendConfirmDialog } from "./send-confirm-dialog";
import { useSession } from "@/components/shell/session-provider";
import {
  campaignPayload,
  canSaveDraft,
  confirmCopy,
  sendBlocks,
  submitLabel,
  successMessage,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardStepId,
  type WizardValues,
} from "@/lib/campaignWizard";
import { formatDateTime, localInputToIso } from "@/lib/schedule";
```

(replace the existing `@/lib/campaignWizard` import block with the one above.)

2. State, after `const shownStep = useRef(stepIndex);`:

```tsx
  const session = useSession();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendErrorRef = useRef<HTMLDivElement>(null);
```

3. After the `preview` hook and the focus effect, add:

```tsx
  // A refused send leaves a panel on the Review step; move focus there once it appears.
  useEffect(() => {
    if (sendError) {
      sendErrorRef.current?.focus();
    }
  }, [sendError]);

  const eligibleCount = preview.data?.summary.eligibleCount ?? null;
  const blocks =
    eligibleCount === null
      ? []
      : sendBlocks({ eligibleCount, emailConfirmed: session.emailConfirmed });
  const canSend = eligibleCount !== null && blocks.length === 0;
  const scheduledIso = localInputToIso(values.scheduledAt);
```

4. In `handleSubmit`, replace the first guard

```tsx
    if (inFlight.current || isReview) {
      return;
    }
```

with

```tsx
    if (inFlight.current) {
      return;
    }

    if (isReview) {
      // The final action asks for confirmation first; nothing is sent from here.
      const reviewErrors = validateStep("review", values);
      if (Object.keys(reviewErrors).length > 0) {
        setErrors(reviewErrors);
        focusFirstInvalid(event.currentTarget);
        return;
      }
      if (canSend) {
        setErrors({});
        setSendError(null);
        setConfirming(true);
      }
      return;
    }
```

5. Add the send handler after `handleSaveDraft`:

```tsx
  async function handleSend() {
    if (inFlight.current || !draftId) {
      return;
    }
    // The chosen time may have passed while the confirm dialog was open.
    const staleErrors = validateStep("review", values);
    if (Object.keys(staleErrors).length > 0) {
      setConfirming(false);
      setErrors(staleErrors);
      focusFirstInvalid(formRef.current);
      return;
    }

    inFlight.current = true;
    setSending(true);
    try {
      const base = `/api/businesses/${businessId}/campaigns/${draftId}`;
      // The queue step reads the stored send time, so save the chosen timing first.
      await apiFetch<Campaign>(base, { method: "PUT", body: campaignPayload(values) });
      await apiFetch(`${base}/queue`, { method: "POST" });
      setConfirming(false);
      toast.success(successMessage(values.timing));
      router.push(`/businesses/${businessId}/campaigns/${draftId}/analytics`);
    } catch (error) {
      setConfirming(false);
      setSendError(
        error instanceof ApiError ? error.message : "Could not send the campaign. Try again.",
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }
```

6. In `handleBack`, add `setSendError(null);` as the first statement.

7. Replace the `StepReview` usage:

```tsx
            <StepReview
              values={values}
              errors={errors}
              onChange={(key, value) => {
                setSendError(null);
                setField(key, value);
              }}
              preview={preview}
              blocks={blocks}
              sendError={sendError}
              sendErrorRef={sendErrorRef}
              onRecheck={() => {
                setSendError(null);
                preview.refetch();
              }}
            />
```

8. Replace the `{!isReview ? ( ... ) : null}` primary-button block with:

```tsx
            {!isReview ? (
              <Button
                type="submit"
                variant="primary"
                loading={busy === "review"}
                disabled={busy === "draft"}
              >
                {step === "message" ? "Review" : "Continue"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                disabled={!canSend || busy !== null || sending}
              >
                {submitLabel(values.timing)}
              </Button>
            )}
```

9. After the closing `</form>`, inside the outer `<div>`, add the dialog (it must sit outside the form):

```tsx
      <SendConfirmDialog
        open={confirming}
        sending={sending}
        onConfirm={handleSend}
        onCancel={() => setConfirming(false)}
        {...confirmCopy({
          recipientCount: eligibleCount ?? 0,
          timing: values.timing,
          scheduledLabel: scheduledIso ? formatDateTime(scheduledIso) : "",
        })}
      />
```

- [ ] **Step 4: Let tests sign in with an unconfirmed email**

In `e2e/helpers/app.ts`, change the `signIn` signature and the seeded user:

```ts
export async function signIn(page: Page, options: { emailConfirmed?: boolean } = {}) {
  const emailConfirmed = options.emailConfirmed ?? true;
  await page.addInitScript((confirmed: boolean) => {
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
          ...(confirmed ? { email_confirmed_at: "2026-01-01T00:00:00Z" } : {}),
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    );
  }, emailConfirmed);
}
```

- [ ] **Step 5: Append the e2e tests**

Append to `e2e/campaign-wizard.spec.ts`:

```ts
async function reachReview(page: import("@playwright/test").Page) {
  await page.goto("/businesses/b1/campaigns/new");
  await goToMessageStep(page, "Autumn menu");
  await page.getByLabel("Message").fill("Fresh loaves.");
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

    await expect(page.getByLabel("Send now")).toBeChecked();
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

    await page.getByLabel("Schedule for later").check();
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

  test("blocks sending, with an explanation, when no one can receive the campaign", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [customer("c-9", "Sam", { email: "sam@example.com" })] },
    });
    await page.goto("/businesses/b1/campaigns/new");
    await goToMessageStep(page, "Autumn menu");
    await page.getByLabel("Message").fill("Fresh loaves.");
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
    await page.getByLabel("Message").fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();

    await expect(page.getByText("Too many recipients")).toBeVisible();
    await expect(page.getByText(/limited to 10 recipients/)).toBeVisible();
    await expect(page.getByText(/would reach 11/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeDisabled();
  });

  test("blocks sending until the account email is confirmed", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await signIn(page, { emailConfirmed: false });
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await reachReview(page);

    await expect(page.getByText("Confirm your email address first")).toBeVisible();
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
        await expect(page.getByLabel("Schedule for later")).toBeChecked();
        await expect(page.getByLabel("Date and time")).not.toHaveValue("");
      } else {
        await expect(page.getByLabel("Send now")).toBeChecked();
        await expect(page.getByLabel("Date and time")).toHaveCount(0);
        await expect(page.getByText("Choose a time in the future.")).toHaveCount(0);
      }
    }
  });
});
```

If the test "blocks sending until the account email is confirmed" shows a signed-in-as-confirmed session despite the override (the init scripts run in order and the later `signIn` overwrites the earlier one), simplify it by moving the `signIn(page, { emailConfirmed: false })` call into the test and moving the file-level `beforeEach` sign-in into a nested `describe` that excludes this test; the assertion must stay.

- [ ] **Step 6: Run everything**

Run: `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`
Expected: exit 0; 0 lint errors.

Run: `npx playwright test e2e/campaign-wizard.spec.ts` then `git checkout -- playwright-report test-results`
Expected: all pass. Verify by reading the test output that the double-click tests would fail without the `inFlight` guard (temporarily remove the guard once to see the failure, then restore it).

Run: `npx vitest run apps/web`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): add timing, send blocking, confirmation and failure handling to the wizard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Re-point entry points, document, and verify the whole phase

**Files:**
- Modify: `apps/web/src/app/(app)/businesses/[businessId]/dashboard/page.tsx`, `apps/web/src/components/dashboard/setup-checklist.tsx`, `e2e/dashboard.spec.ts`, `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`
- Create: `e2e/campaign-accessibility.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the finished phase.

- [ ] **Step 1: Re-point "New campaign" and the checklist**

In `apps/web/src/app/(app)/businesses/[businessId]/dashboard/page.tsx` change the "New campaign" link's `href` from `` `/businesses/${businessId}/campaigns` `` to `` `/businesses/${businessId}/campaigns/new` ``.

In `apps/web/src/components/dashboard/setup-checklist.tsx` change the second step's link to `href={`/businesses/${businessId}/campaigns/new`}` and its text from "Go to campaigns" to "Create a campaign".

In `e2e/dashboard.spec.ts` rename the test to `"quick actions open the customer dialog and the campaign wizard"` and change its final assertion to `await expect(page).toHaveURL(/\/businesses\/b1\/campaigns\/new$/);`. If any other dashboard test asserts the checklist link text "Go to campaigns", update it to "Create a campaign" (a search showed none at planning time).

- [ ] **Step 2: Keyboard-only and small-screen tests**

Create `e2e/campaign-accessibility.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const people = [
  customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true }),
  customer("c-2", "Grace", { email: "grace@navy.test", emailOptIn: true }),
];

test.describe("campaign pages: keyboard and small screens", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the whole wizard can be completed with the keyboard", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");

    await page.getByLabel("Campaign name").focus();
    await page.keyboard.type("Autumn menu");
    await page.keyboard.press("Enter"); // submits the step: Continue
    await expect(page.getByRole("heading", { level: 2, name: "Recipients" })).toBeFocused();

    await page.getByRole("button", { name: "Continue" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Message" })).toBeFocused();

    await page.getByLabel("Message").focus();
    await page.keyboard.type("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

    await page.getByRole("button", { name: "Send now" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Send to 2 customers now?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Send now" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/analytics$/);
  });

  test("Escape closes the confirmation and returns focus to the send button", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people } });
    await page.goto("/businesses/b1/campaigns/new");
    await page.getByLabel("Campaign name").fill("Autumn menu");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Message").fill("Fresh loaves.");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();

    const send = page.getByRole("button", { name: "Send now" });
    await send.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(send).toBeFocused();
  });

  for (const path of ["/businesses/b1/campaigns", "/businesses/b1/campaigns/new"]) {
    test(`${path} does not scroll sideways at 375px`, async ({ page }) => {
      await mockApi(page, {
        businesses: [bakery],
        customers: { b1: people },
        campaigns: {
          b1: [
            campaign("k-1", "A campaign name that is much longer than the phone screen is wide, to test wrapping"),
            campaign("k-4", "Loyalty thanks", { status: "SENT" }),
          ],
        },
        analytics: { "k-4": { eligibleCount: 4, sentCount: 3, failedDeliveryCount: 1 } },
      });
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
```

- [ ] **Step 3: Update the spec in place**

Edit `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`: rewrite the **Campaign list** and **Campaign wizard** paragraphs of section 7 in place (do not append corrections) so they describe the build exactly:

- List: table from `xl`, cards below; columns Name (links to the campaign), Channel, Status, When, Delivery, row menu; status labels Draft / Queued ("Waiting to be sent") / Scheduled (derived from a future `sendAt`) / Sent / Failed; the When wording; the Delivery wording (`3 of 4 sent, 1 failed`, "Not sent yet", "Unavailable"); delivery numbers fetched only for non-drafts on the visible page; 25 per page; SMS drafts show "SMS sending is paused" and offer Delete only; email drafts offer Edit and Delete (confirm); empty state.
- Wizard: four steps with the exact titles ("Basics", "Recipients", "Message", "Review and send"); state kept while moving between steps; focus moves to the step heading; the Recipients step wording (opted-in count from the dashboard endpoint, which may include customers without an email address, zero-customer warning with a link that opens in a new tab, the two sending limits); the Message step (subject is the campaign name, live preview, unsubscribe note, informational character count); the Review step (entering it creates or updates the draft and says so, exact eligible and skipped counts with merged plain-language reasons, Send now or Schedule, time zone note, Check again); the three blocking states and that "email not confirmed" has no Account link until Phase 5; the confirm dialog wording for both timings; the PUT-then-queue order; the persistent inline panel for server refusals with the draft kept; success lands on the Results tab with a toast ("Campaign queued" / "Campaign scheduled"); "Save draft" saves and returns to the list; `/edit` for a sent, queued, SMS or unknown campaign shows an explanation.
- In section 11 note that the safety limits are mirrored in `apps/web/src/lib/campaignLimits.ts` with a parity test instead of importing the package.
- In section 10 leave the phase list as is.

- [ ] **Step 4: Full verification**

Run each and read the output:

```bash
npx tsc --noEmit -p apps/web
npm run lint -w apps/web
npx vitest run apps/web
npm test
npm run build -w apps/web
npx playwright test
git checkout -- playwright-report test-results
git status --short
```

Expected: tsc exit 0; lint 0 errors (4 pre-existing warnings); vitest all pass; `npm test` shows exactly one failing file (`apps/api/src/routes/campaign.test.ts`, the known `env.js` baseline); the web build succeeds and lists the routes `/businesses/[businessId]/campaigns`, `/campaigns/new` and `/campaigns/[campaignId]/edit`; Playwright all pass (77 in total: 47 existing, 7 list, 19 wizard, 4 accessibility); `git status` shows only intended files.

- [ ] **Step 5: Visual pass**

Start the web app against mocked data is not possible without a backend, so use the Playwright-driven checks above plus one manual look: run `npm run dev -w apps/web`, sign in is not available offline, so state in the final report that visual review of the authenticated screens was done through the e2e mock only. If a real Supabase and API are available locally, open the list, the wizard (all four steps, both timings, a blocked state) at 375, 768 and 1280px in light and dark, and note anything off.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src e2e docs/superpowers/specs
git commit -m "feat(web): point New campaign at the wizard; document and test the campaign flow

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (section 7 "Campaign list" and "Campaign wizard", sections 3, 3a, 8, 9):**
- Table columns, audience column dropped, delivery fetched only for non-drafts: Task 3.
- Statuses Draft/Queued/Scheduled/Sent/Failed, SMS badge and note, SMS drafts Delete only, email drafts Edit/Delete with confirm, rows open detail: Tasks 1 and 3.
- Wizard steps 1 to 4, no audience selector, limits shown, live preview, subject = name, unsubscribe note, informational character count: Task 4.
- Review creates/updates the draft and discloses it, exact counts with reasons, Send now or Schedule (future only), blocking states (zero, over limit, unconfirmed email), confirm dialog text, 403/409 shown persistently with the draft kept, success lands on Results with a toast: Task 5. Account link for the unconfirmed block is deferred to Phase 5 (decided above).
- "Save draft" at any step once name and message exist, visually distinct: Task 4. Inline validation with focus on the first invalid field: Tasks 2 and 4.
- `/edit` for non-editable or unknown campaigns explains and links back: Task 4. ISO schedule and time-zone statement: Tasks 1, 2, 5.
- Open item 11 (import limits vs mirror): resolved in Spec deviations with a parity test.
- Accessibility (keyboard, focus management, Escape, touch targets, no horizontal overflow): Tasks 4 to 6.
- Testing section: pure logic unit-tested in Node (Tasks 1, 2); component behaviour in Playwright with mocks (Tasks 3 to 6).

**Placeholder scan:** none; every code step has complete code. The two conditional notes in Task 5 Step 5 and Task 6 Step 5 are instructions about what to do if a specific, named failure appears, not omitted content.

**Type consistency:** `WizardValues`, `PreviewState`, `CampaignDelivery`, `SendBlock`, `DisplayStatus`, `RowAction` are defined once (Tasks 1, 2, 4) and used by those names later. `setField` keeps the generic signature the Task 5 `StepReview` prop expects. `CampaignStatusBadge` keeps working for the dashboard because `sendAt` is optional.
