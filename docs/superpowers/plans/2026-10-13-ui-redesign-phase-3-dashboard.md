# DireConnect UI Redesign, Phase 3: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy Dashboard page with a focused overview: quick actions, a setup checklist that appears only while it applies, customer and campaign summaries, a delivery chart, and recent campaigns, all built from real `/dashboard` data.

**Architecture:** Pure logic (delivery segments, success-rate wording, setup steps, campaign status metadata, link targets, date formatting) lives in `src/lib` and is unit-tested in Node. Small presentational components live in `src/components/dashboard` and `src/components/campaigns` (the status badge is reused by the Phase 4 campaign list). The page fetches once with `useApi`, refetches after the inline "Add customer" dialog saves, and stays thin.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, Vitest (node environment), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (section 7 "Dashboard"). Phases 1 and 2 (tokens, shell, data layer, Businesses and Customers pages) are merged on `main`; this plan builds on their exact APIs.

## Global Constraints

Carried verbatim from Phases 1 and 2:

- Scope is `apps/web`, `e2e/`, and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts. No new dependencies.
- Light theme by default; dark follows `prefers-color-scheme`. Colours come only from the token utilities (`bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `bg-accent-soft`, `bg-success`/`text-success`/`bg-success-soft`, `bg-warning`/`text-warning`/`bg-warning-soft`, `bg-danger`/`text-danger`/`bg-danger-soft`, `rounded-control` = 6px, `rounded-container` = 10px, `shadow-float`). No raw `gray-`/`blue-` classes.
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Touch targets: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths; icon-only buttons `min-h-10 min-w-10`; text links used as controls get `min-h-10` (or are rendered with `buttonClasses`).
- Meaning is never conveyed by colour alone: every status carries an icon and a text label.
- Motion only in response to a user action. Loading indicators (spinner, skeleton pulse) are exempt (reduced-motion disables them globally).
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- Copy: active voice, sentence case, the same verb for button and toast. Errors state what happened and how to fix it; no apologies.
- **Modal convention:** inside a dialog, errors are shown inline; a toast is fired as/after the dialog closes. Close every modal before toasting. Unmapped server field errors fall back to `FormError`. A dialog with a request in flight is not dismissible. (The reused `CustomerFormDialog` already does all of this.)
- `useApi` returns `{ data, error, loading, slow, refetch }`, scopes its state to the current path, and keeps old data while the same path refetches. `useBusinesses()` returns `{ businesses, status, error, slow, refetch, addBusiness }`.
- Shell layout: pages render inside `<main id="main-content">`; use `PageContainer` + `PageHeader` (supplies the page's single `<h1>`). Key page content by `businessId` so state resets on business change.
- Work on branch `ui-redesign-phase-3`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` verbatim (whichever model you are).
- Playwright runs modify the TRACKED `playwright-report/` and `test-results/`; restore them after each run (`git checkout -- playwright-report test-results`) and never commit them.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

**Chart rules (from the dataviz guidance) for the delivery bar:**
- It is a part-to-whole chart of three status values, so a single horizontal stacked bar (not a donut), at most 6 segments.
- Bar thickness at most 24px (`h-3` = 12px); 4px rounded outer ends (use `rounded-l-[4px]` / `rounded-r-[4px]`); a 2px gap in the surface colour between segments (`gap-0.5`).
- Status colours are reserved for status: sent = success, failed = danger, pending = warning. They always ship with an icon and a text label (the legend); legend text uses the ink/muted text tokens, never the series colour; the coloured swatch and icon carry identity.
- No number printed on the segments. The legend lists every state with its count and percentage and doubles as the table view; the bar itself is `role="img"` with an `aria-label` listing all counts. Each segment has a native `title` tooltip.
- Large standalone numbers use proportional figures (no `tabular-nums`); `tabular-nums` only in aligned columns of numbers.
- A tiny non-zero segment must stay visible (`min-w-1` = 4px).

## Facts about the `/dashboard` API this plan relies on

`GET /api/businesses/:id/dashboard` returns `{ business, summary, recentCampaigns }` where `summary.customers = { total, emailOptedIn, smsOptedIn, unsubscribed }`, `summary.campaigns = { total, draft, queued, sent, failed }`, `summary.messages = { totalLogs, sent, failed, pending, successRate: number | null }`, and `recentCampaigns[]` = `{ id, title, channel: "EMAIL" | "SMS", targetAudience, status: "DRAFT" | "QUEUED" | "SENT" | "FAILED", createdAt }`. It has no time series and no `sendAt`.
- `emailOptedIn` counts `emailOptIn && unsubscribedAt = null` (the same rule as the Customers page).
- `unsubscribed` counts `unsubscribedAt != null`, which also includes customers who never opted in (creating a customer with no opt-ins stores `unsubscribedAt = now`). **Do not display it as "Unsubscribed".** Show **Not opted in** = `total - emailOptedIn`.
- SMS is paused: do not show SMS counts.

## Spec deviations (decided here)

- "Recent campaigns" is a responsive list of rows, not a table (a handful of rows reads better as a list on every width).
- Because `sendAt` is not in the payload, a queued campaign shows as **Queued**; "Scheduled" arrives with the Phase 4 campaign list.
- "New campaign" links to the campaigns list for now (it holds the existing create form); Phase 4 re-points it to the new campaign wizard. Recent-campaign links go to the existing preview (drafts) and analytics (others) routes; Phase 5 re-points them to the campaign detail tabs.
- The business's own details are not shown on the dashboard; a footer link sends the owner to the Businesses page, where each card has Edit.
- The delivery bar's hover tooltip is the native `title` attribute; the legend always shows every value, so no data depends on hover.

## Baseline (recorded 2026-10-13 on `main` at `03888da`)

- `npm test`: 21 files pass, 1 fails (`apps/api/src/routes/campaign.test.ts`, `SUPABASE_JWT_SECRET`, a stale git-ignored `apps/api/src/config/env.js`; **not part of this work, do not touch**), 155 tests pass.
- `npm run lint -w apps/web`: 0 errors, 5 warnings (legacy campaign and dashboard pages). The legacy dashboard page is rewritten here, so expect 4 afterwards.
- `npx playwright test`: 37 passed.
- `tsc` may report stale `.next/types` errors until a production build has run; fix by running `NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web` once, then re-run `tsc`.
- Editor diagnostics (`71007 Props must be serializable…`, `FormEvent is deprecated`) are advisory; ignore them.

## Review Focus

1. A business with no messages (or `successRate: null`) must show "No messages sent yet", never `NaN%`, `0%` or an empty bar (Task 1 unit tests; Task 5 e2e).
2. The API's `unsubscribed` count includes never-opted-in customers; the dashboard must show **Not opted in = total − emailOptedIn** and never label anything "Unsubscribed" (Task 1 unit test; Task 5 e2e asserts the numbers).
3. A tiny non-zero delivery segment (for example 1 failed of 1,001) must remain visible and legible in the legend (Task 5 e2e measures the segment's width).
4. After adding a customer from the dashboard, the checklist step and the customer counts update without a reload (Task 5 e2e).
5. A failed or slow dashboard load shows an error state with a retry (and the "waking up" notice while slow), never a blank page (Task 4 states; Task 5 e2e).

---

### Task 1: Pure logic: dashboard and campaign-status helpers

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/dashboard.ts`, `apps/web/src/lib/dashboard.test.ts`
- Create: `apps/web/src/lib/campaignStatus.ts`, `apps/web/src/lib/campaignStatus.test.ts`

**Interfaces (produced):**
- `types.ts`: `CampaignStatus`, `CampaignChannel`, `CampaignAudience`, `DashboardSummary`, `DashboardCampaign`, `DashboardResponse`
- `campaignStatus.ts`: `type StatusTone = "neutral" | "accent" | "success" | "danger"`; `type StatusIcon = "edit" | "send" | "check" | "alert"`; `campaignStatusMeta(status): { label: string; tone: StatusTone; icon: StatusIcon }`; `channelLabel(channel): string`
- `dashboard.ts`: `notOptedInCount(customers)`; `type DeliverySegment`; `deliverySegments(messages)`; `successRateLabel(rate)`; `type SetupStep`; `setupSteps(summary)`; `showSetupChecklist(steps)`; `campaignHref(businessId, campaign)`; `formatDate(iso, timeZone?)`

- [ ] **Step 1: Create the branch**

```bash
git switch -c ui-redesign-phase-3
git add docs/superpowers/plans/2026-10-13-ui-redesign-phase-3-dashboard.md
git commit -m "docs: add UI redesign phase 3 plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Add the types**

Append to `apps/web/src/lib/types.ts`:

```ts

export type CampaignStatus = "DRAFT" | "QUEUED" | "SENT" | "FAILED";
export type CampaignChannel = "EMAIL" | "SMS";
export type CampaignAudience = "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";

export type DashboardSummary = {
  customers: { total: number; emailOptedIn: number; smsOptedIn: number; unsubscribed: number };
  campaigns: { total: number; draft: number; queued: number; sent: number; failed: number };
  messages: {
    totalLogs: number;
    sent: number;
    failed: number;
    pending: number;
    successRate: number | null;
  };
};

export type DashboardCampaign = {
  id: string;
  title: string;
  channel: CampaignChannel;
  targetAudience: CampaignAudience;
  status: CampaignStatus;
  createdAt: string;
};

export type DashboardResponse = {
  business: Business;
  summary: DashboardSummary;
  recentCampaigns: DashboardCampaign[];
};
```

- [ ] **Step 3: Write the failing tests**

`apps/web/src/lib/campaignStatus.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { campaignStatusMeta, channelLabel } from "./campaignStatus";

describe("campaignStatusMeta", () => {
  it("gives every status a label, a tone and an icon", () => {
    expect(campaignStatusMeta("DRAFT")).toEqual({ label: "Draft", tone: "neutral", icon: "edit" });
    expect(campaignStatusMeta("QUEUED")).toEqual({ label: "Queued", tone: "accent", icon: "send" });
    expect(campaignStatusMeta("SENT")).toEqual({ label: "Sent", tone: "success", icon: "check" });
    expect(campaignStatusMeta("FAILED")).toEqual({ label: "Failed", tone: "danger", icon: "alert" });
  });

  it("never reuses an icon, so status is not carried by colour alone", () => {
    const icons = (["DRAFT", "QUEUED", "SENT", "FAILED"] as const).map(
      (status) => campaignStatusMeta(status).icon,
    );
    expect(new Set(icons).size).toBe(4);
  });
});

describe("channelLabel", () => {
  it("names the channels", () => {
    expect(channelLabel("EMAIL")).toBe("Email");
    expect(channelLabel("SMS")).toBe("SMS");
  });
});
```

`apps/web/src/lib/dashboard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  campaignHref,
  deliverySegments,
  formatDate,
  notOptedInCount,
  setupSteps,
  showSetupChecklist,
  successRateLabel,
} from "./dashboard";
import type { DashboardSummary } from "./types";

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    customers: { total: 0, emailOptedIn: 0, smsOptedIn: 0, unsubscribed: 0 },
    campaigns: { total: 0, draft: 0, queued: 0, sent: 0, failed: 0 },
    messages: { totalLogs: 0, sent: 0, failed: 0, pending: 0, successRate: null },
    ...overrides,
  };
}

describe("notOptedInCount", () => {
  it("is everyone who is not opted in, never the API's unsubscribed count", () => {
    // 10 customers, 6 opted in. The API would report `unsubscribed: 4` here, but it also
    // counts people who never opted in, so the dashboard derives the number itself.
    expect(notOptedInCount({ total: 10, emailOptedIn: 6 })).toBe(4);
  });

  it("never goes negative", () => {
    expect(notOptedInCount({ total: 2, emailOptedIn: 5 })).toBe(0);
    expect(notOptedInCount({ total: 0, emailOptedIn: 0 })).toBe(0);
  });
});

describe("deliverySegments", () => {
  it("returns nothing when no messages exist, so the page shows the empty message", () => {
    expect(deliverySegments({ sent: 0, failed: 0, pending: 0 })).toEqual([]);
  });

  it("returns every state, including zeros, with counts and percentages", () => {
    expect(deliverySegments({ sent: 8, failed: 1, pending: 1 })).toEqual([
      { key: "sent", label: "Sent", count: 8, percent: 80 },
      { key: "failed", label: "Failed", count: 1, percent: 10 },
      { key: "pending", label: "Pending", count: 1, percent: 10 },
    ]);
    expect(deliverySegments({ sent: 5, failed: 0, pending: 0 })).toEqual([
      { key: "sent", label: "Sent", count: 5, percent: 100 },
      { key: "failed", label: "Failed", count: 0, percent: 0 },
      { key: "pending", label: "Pending", count: 0, percent: 0 },
    ]);
  });

  it("keeps a tiny share visible in the numbers", () => {
    const tiny = deliverySegments({ sent: 1000, failed: 1, pending: 0 });
    expect(tiny[1]).toMatchObject({ key: "failed", count: 1 });
    expect(tiny[1].percent).toBeGreaterThan(0);
  });
});

describe("successRateLabel", () => {
  it("is null when there is no rate", () => {
    expect(successRateLabel(null)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(successRateLabel(89)).toBe("89% success rate");
    expect(successRateLabel(66.67)).toBe("67% success rate");
    expect(successRateLabel(0)).toBe("0% success rate");
  });
});

describe("setupSteps", () => {
  it("starts with both steps open for a brand-new business", () => {
    const steps = setupSteps(summary());
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["customer", false],
      ["campaign", false],
    ]);
    expect(showSetupChecklist(steps)).toBe(true);
  });

  it("marks the customer step done once there is a customer", () => {
    const steps = setupSteps(summary({ customers: { total: 1, emailOptedIn: 0, smsOptedIn: 0, unsubscribed: 1 } }));
    expect(steps[0].done).toBe(true);
    expect(steps[1].done).toBe(false);
    expect(showSetupChecklist(steps)).toBe(true);
  });

  it("does not count a draft as a sent campaign", () => {
    const steps = setupSteps(
      summary({ campaigns: { total: 2, draft: 2, queued: 0, sent: 0, failed: 0 } }),
    );
    expect(steps[1].done).toBe(false);
  });

  it("counts a queued, sent or failed campaign as the campaign step", () => {
    for (const campaigns of [
      { total: 1, draft: 0, queued: 1, sent: 0, failed: 0 },
      { total: 1, draft: 0, queued: 0, sent: 1, failed: 0 },
      { total: 1, draft: 0, queued: 0, sent: 0, failed: 1 },
    ]) {
      expect(setupSteps(summary({ campaigns }))[1].done).toBe(true);
    }
  });

  it("hides the checklist once both steps are done", () => {
    const steps = setupSteps(
      summary({
        customers: { total: 3, emailOptedIn: 3, smsOptedIn: 0, unsubscribed: 0 },
        campaigns: { total: 1, draft: 0, queued: 0, sent: 1, failed: 0 },
      }),
    );
    expect(showSetupChecklist(steps)).toBe(false);
  });
});

describe("campaignHref", () => {
  it("opens drafts in the preview and everything else in the analytics view", () => {
    expect(campaignHref("b1", { id: "c9", status: "DRAFT" })).toBe(
      "/businesses/b1/campaigns/c9/preview",
    );
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(campaignHref("b1", { id: "c9", status })).toBe(
        "/businesses/b1/campaigns/c9/analytics",
      );
    }
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp as a medium date", () => {
    expect(formatDate("2026-10-12T15:30:00Z", "UTC")).toBe("Oct 12, 2026");
  });

  it("returns an empty string for an invalid date instead of throwing", () => {
    expect(formatDate("not a date")).toBe("");
  });
});
```

- [ ] **Step 4: Run and confirm they fail**

Run: `npx vitest run apps/web/src/lib/dashboard.test.ts apps/web/src/lib/campaignStatus.test.ts`
Expected: FAIL (modules do not exist).

- [ ] **Step 5: Implement**

`apps/web/src/lib/campaignStatus.ts`:

```ts
import type { CampaignChannel, CampaignStatus } from "./types";

export type StatusTone = "neutral" | "accent" | "success" | "danger";
export type StatusIcon = "edit" | "send" | "check" | "alert";

const STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: "edit" },
  QUEUED: { label: "Queued", tone: "accent", icon: "send" },
  SENT: { label: "Sent", tone: "success", icon: "check" },
  FAILED: { label: "Failed", tone: "danger", icon: "alert" },
};

/** Every status has its own icon as well as a colour, so it never relies on colour alone. */
export function campaignStatusMeta(status: CampaignStatus) {
  return STATUS_META[status];
}

export function channelLabel(channel: CampaignChannel): string {
  return channel === "SMS" ? "SMS" : "Email";
}
```

`apps/web/src/lib/dashboard.ts`:

```ts
import type { DashboardCampaign, DashboardSummary } from "./types";

/**
 * The API's `unsubscribed` count includes customers who never opted in (creating a customer
 * without consent stores `unsubscribedAt`), so "not opted in" is derived from the totals.
 */
export function notOptedInCount(
  customers: Pick<DashboardSummary["customers"], "total" | "emailOptedIn">,
): number {
  return Math.max(0, customers.total - customers.emailOptedIn);
}

export type DeliverySegment = {
  key: "sent" | "failed" | "pending";
  label: string;
  count: number;
  percent: number;
};

/** All three states (zeros included, for the legend), or nothing when no message exists. */
export function deliverySegments(
  messages: Pick<DashboardSummary["messages"], "sent" | "failed" | "pending">,
): DeliverySegment[] {
  const total = messages.sent + messages.failed + messages.pending;
  if (total <= 0) {
    return [];
  }

  const share = (count: number) => Math.round((count / total) * 1000) / 10;

  return [
    { key: "sent", label: "Sent", count: messages.sent, percent: share(messages.sent) },
    { key: "failed", label: "Failed", count: messages.failed, percent: share(messages.failed) },
    { key: "pending", label: "Pending", count: messages.pending, percent: share(messages.pending) },
  ];
}

export function successRateLabel(rate: number | null): string | null {
  return rate === null ? null : `${Math.round(rate)}% success rate`;
}

export type SetupStep = {
  id: "customer" | "campaign";
  title: string;
  description: string;
  done: boolean;
};

export function setupSteps(summary: Pick<DashboardSummary, "customers" | "campaigns">): SetupStep[] {
  const { customers, campaigns } = summary;

  return [
    {
      id: "customer",
      title: "Add your first customer",
      description: "Only customers who agreed to receive emails will get your campaigns.",
      done: customers.total > 0,
    },
    {
      id: "campaign",
      title: "Send your first campaign",
      description: "Write a message and send it to the customers who opted in.",
      // A draft has not been sent: only queued, sent and failed campaigns count.
      done: campaigns.queued + campaigns.sent + campaigns.failed > 0,
    },
  ];
}

export function showSetupChecklist(steps: SetupStep[]): boolean {
  return steps.some((step) => !step.done);
}

/** Drafts open in the preview; everything else opens the results view. */
export function campaignHref(
  businessId: string,
  campaign: Pick<DashboardCampaign, "id" | "status">,
): string {
  const section = campaign.status === "DRAFT" ? "preview" : "analytics";
  return `/businesses/${businessId}/campaigns/${campaign.id}/${section}`;
}

export function formatDate(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
```

- [ ] **Step 6: Run and confirm they pass**

Run: `npx vitest run apps/web/src/lib`
Expected: PASS for every file under `apps/web/src/lib`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): add dashboard and campaign-status helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Status badge, panel frame and delivery chart

**Files:**
- Modify: `apps/web/src/components/ui/icons.tsx`
- Create: `apps/web/src/components/campaigns/status-badge.tsx`
- Create: `apps/web/src/components/dashboard/panel.tsx`
- Create: `apps/web/src/components/dashboard/delivery-panel.tsx`

**Interfaces:**
- Consumes: Task 1 (`campaignStatusMeta`, `deliverySegments`, `successRateLabel`, `DashboardSummary`), Phase 2 `Badge`.
- Produces: `IconName` gains `"clock"`; `CampaignStatusBadge({ status: CampaignStatus })`; `Panel({ id: string; title: string; children; className? })` (a `<section aria-labelledby>` with an `<h2>`); `PanelRow({ label: ReactNode; value: ReactNode })` (a `<dl>` row); `DeliveryPanel({ messages: DashboardSummary["messages"] })`.

No unit tests (Node-only Vitest, no DOM); verification is type-check, lint, and the Task 5 e2e tests.

- [ ] **Step 1: Add the `clock` icon**

In `apps/web/src/components/ui/icons.tsx`, add to the `PATHS` object (before the closing `} as const;`):

```ts
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
```

- [ ] **Step 2: `status-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { campaignStatusMeta } from "@/lib/campaignStatus";
import type { CampaignStatus } from "@/lib/types";

/** Draft, Queued, Sent or Failed: always an icon plus a word, never colour alone. */
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta = campaignStatusMeta(status);

  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
```

- [ ] **Step 3: `panel.tsx`**

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-container border border-line bg-surface p-5", className)}
    >
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One label/value line inside a `<dl>`. Values use tabular figures so they align in a column. */
export function PanelRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
```

- [ ] **Step 4: `delivery-panel.tsx`**

```tsx
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { deliverySegments, successRateLabel, type DeliverySegment } from "@/lib/dashboard";
import type { DashboardSummary } from "@/lib/types";
import { Panel } from "./panel";

// Status colours are reserved for status; each state also has an icon and a word in the legend.
const STYLE: Record<DeliverySegment["key"], { fill: string; icon: IconName; iconColor: string }> = {
  sent: { fill: "bg-success", icon: "check", iconColor: "text-success" },
  failed: { fill: "bg-danger", icon: "alert", iconColor: "text-danger" },
  pending: { fill: "bg-warning", icon: "clock", iconColor: "text-warning" },
};

export function DeliveryPanel({ messages }: { messages: DashboardSummary["messages"] }) {
  const segments = deliverySegments(messages);
  const drawn = segments.filter((segment) => segment.count > 0);
  const rate = successRateLabel(messages.successRate);

  return (
    <Panel id="delivery-heading" title="Delivery">
      {segments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No messages sent yet. Results appear here after your first campaign goes out.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Messages: ${segments
              .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
              .join(", ")}`}
            className="mt-4 flex h-3 gap-0.5"
          >
            {drawn.map((segment, index) => (
              <div
                key={segment.key}
                title={`${segment.label}: ${segment.count} (${Math.round(segment.percent)}%)`}
                className={cn(
                  "min-w-1",
                  STYLE[segment.key].fill,
                  index === 0 && "rounded-l-[4px]",
                  index === drawn.length - 1 && "rounded-r-[4px]",
                )}
                style={{ flexGrow: segment.count, flexBasis: 0 }}
              />
            ))}
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", STYLE[segment.key].fill)}
                />
                <dt className="flex items-center gap-1 font-medium text-ink">
                  <Icon name={STYLE[segment.key].icon} className={STYLE[segment.key].iconColor} />
                  {segment.label}
                </dt>
                <dd className="ml-auto text-ink sm:ml-0">
                  <span className="font-semibold">{segment.count}</span>{" "}
                  <span className="text-muted">({Math.round(segment.percent)}%)</span>
                </dd>
              </div>
            ))}
          </dl>

          {rate ? <p className="mt-4 text-sm text-muted">{rate}</p> : null}
        </>
      )}
    </Panel>
  );
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors (if ONLY stale `.next/types` errors appear, run the production build once, then re-run tsc); lint 0 errors, no new warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components apps/web/src/lib
git commit -m "feat(web): add campaign status badge, panel frame and delivery chart" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Setup checklist, summary panels and recent campaigns

**Files (all new, under `apps/web/src/components/dashboard/`):**
- `setup-checklist.tsx`, `customers-panel.tsx`, `campaigns-panel.tsx`, `recent-campaigns.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 `Panel`, `PanelRow`, `CampaignStatusBadge`, Phase 2 `buttonClasses`, `Button`, `Icon`.
- Produces: `SetupChecklist({ businessId; steps: SetupStep[]; onAddCustomer: () => void })`; `CustomersPanel({ businessId; customers })`; `CampaignsPanel({ businessId; campaigns })`; `RecentCampaigns({ businessId; campaigns: DashboardCampaign[] })`.

No unit tests; verification is type-check, lint, and the Task 5 e2e tests.

- [ ] **Step 1: `setup-checklist.tsx`**

```tsx
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SetupStep } from "@/lib/dashboard";

/** Shown only while a step is open. A finished step shows a check mark, an open one an empty ring. */
export function SetupChecklist({
  businessId,
  steps,
  onAddCustomer,
}: {
  businessId: string;
  steps: SetupStep[];
  onAddCustomer: () => void;
}) {
  return (
    <section
      aria-labelledby="setup-heading"
      className="mb-4 rounded-container border border-line bg-surface p-5"
    >
      <h2 id="setup-heading" className="text-base font-semibold text-ink">
        Get started
      </h2>
      <p className="mt-1 text-sm text-muted">Two steps to your first campaign.</p>

      <ol className="mt-4 divide-y divide-line">
        {steps.map((step) => (
          <li key={step.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                step.done
                  ? "border-success bg-success-soft text-success"
                  : "border-line-strong text-transparent",
              )}
            >
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", step.done ? "text-muted" : "text-ink")}>
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </p>
              {step.done ? null : <p className="text-[13px] text-muted">{step.description}</p>}
            </div>

            {step.done ? null : step.id === "customer" ? (
              <Button variant="primary" onClick={onAddCustomer}>
                Add customer
              </Button>
            ) : (
              <Link
                href={`/businesses/${businessId}/campaigns`}
                className={buttonClasses({ variant: "secondary" })}
              >
                Go to campaigns
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 2: `customers-panel.tsx`**

```tsx
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { notOptedInCount } from "@/lib/dashboard";
import type { DashboardSummary } from "@/lib/types";
import { Panel, PanelRow } from "./panel";

export function CustomersPanel({
  businessId,
  customers,
}: {
  businessId: string;
  customers: DashboardSummary["customers"];
}) {
  return (
    <Panel id="customers-heading" title="Customers" className="flex flex-col">
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight text-ink">{customers.total}</span>{" "}
        <span className="text-sm text-muted">{customers.total === 1 ? "customer" : "customers"}</span>
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <PanelRow label="Opted in to email" value={customers.emailOptedIn} />
        <PanelRow label="Not opted in" value={notOptedInCount(customers)} />
      </dl>

      <Link
        href={`/businesses/${businessId}/customers`}
        className={buttonClasses({ variant: "ghost", className: "-ml-3.5 mt-4 self-start" })}
      >
        View customers
      </Link>
    </Panel>
  );
}
```

- [ ] **Step 3: `campaigns-panel.tsx`**

```tsx
import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { buttonClasses } from "@/components/ui/button";
import type { DashboardSummary } from "@/lib/types";
import { Panel, PanelRow } from "./panel";

export function CampaignsPanel({
  businessId,
  campaigns,
}: {
  businessId: string;
  campaigns: DashboardSummary["campaigns"];
}) {
  return (
    <Panel id="campaigns-heading" title="Campaigns" className="flex flex-col">
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight text-ink">{campaigns.total}</span>{" "}
        <span className="text-sm text-muted">{campaigns.total === 1 ? "campaign" : "campaigns"}</span>
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <PanelRow label={<CampaignStatusBadge status="DRAFT" />} value={campaigns.draft} />
        <PanelRow label={<CampaignStatusBadge status="QUEUED" />} value={campaigns.queued} />
        <PanelRow label={<CampaignStatusBadge status="SENT" />} value={campaigns.sent} />
        <PanelRow label={<CampaignStatusBadge status="FAILED" />} value={campaigns.failed} />
      </dl>

      <Link
        href={`/businesses/${businessId}/campaigns`}
        className={buttonClasses({ variant: "ghost", className: "-ml-3.5 mt-4 self-start" })}
      >
        View campaigns
      </Link>
    </Panel>
  );
}
```

- [ ] **Step 4: `recent-campaigns.tsx`**

```tsx
import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { campaignHref, formatDate } from "@/lib/dashboard";
import { channelLabel } from "@/lib/campaignStatus";
import type { DashboardCampaign } from "@/lib/types";
import { Panel } from "./panel";

export function RecentCampaigns({
  businessId,
  campaigns,
}: {
  businessId: string;
  campaigns: DashboardCampaign[];
}) {
  return (
    <Panel id="recent-heading" title="Recent campaigns">
      {campaigns.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No campaigns yet. Your latest campaigns will show up here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 first:pt-0 last:pb-0"
            >
              <Link
                href={campaignHref(businessId, campaign)}
                className="inline-flex min-h-10 min-w-0 flex-1 items-center truncate text-sm font-medium text-ink hover:underline"
              >
                <span className="truncate">{campaign.title}</span>
              </Link>
              <CampaignStatusBadge status={campaign.status} />
              <span className="text-[13px] text-muted">{channelLabel(campaign.channel)}</span>
              <time dateTime={campaign.createdAt} className="text-[13px] text-muted">
                {formatDate(campaign.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; lint 0 errors, no new warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard
git commit -m "feat(web): add setup checklist, summary panels and recent campaigns" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Dashboard page

**Files:**
- Rewrite: `apps/web/src/app/(app)/businesses/[businessId]/dashboard/page.tsx`

**Interfaces:**
- Consumes: Tasks 1-3, Phase 2 `CustomerFormDialog`, `PageContainer`, `PageHeader`, `ListSkeleton`, `EmptyState`/`ErrorState`, `Button`, `buttonClasses`, `Icon`; Phase 1 `useApi`, `useBusinesses`.
- Produces: the redesigned page. Header actions: **Add customer** (opens the shared dialog; the dashboard refetches on save) and **New campaign** (a link to the campaigns list for now).

- [ ] **Step 1: Replace the page**

Replace the entire contents of `apps/web/src/app/(app)/businesses/[businessId]/dashboard/page.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CampaignsPanel } from "@/components/dashboard/campaigns-panel";
import { CustomersPanel } from "@/components/dashboard/customers-panel";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { RecentCampaigns } from "@/components/dashboard/recent-campaigns";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { setupSteps, showSetupChecklist } from "@/lib/dashboard";
import type { DashboardResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function DashboardPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so open dialogs reset when the business changes.
  return <DashboardView key={businessId} businessId={businessId} />;
}

function DashboardView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const { data, error, slow, refetch } = useApi<DashboardResponse>(
    `/api/businesses/${businessId}/dashboard`,
  );
  const [addingCustomer, setAddingCustomer] = useState(false);

  const steps = data ? setupSteps(data.summary) : [];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName },
          { label: "Dashboard" },
        ]}
        title="Dashboard"
        description="How your customers and campaigns are doing."
        actions={
          <>
            <Link
              href={`/businesses/${businessId}/campaigns`}
              className={buttonClasses({ variant: "secondary" })}
            >
              New campaign
            </Link>
            <Button variant="primary" onClick={() => setAddingCustomer(true)}>
              <Icon name="plus" />
              Add customer
            </Button>
          </>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : data === null && error ? (
        <ErrorState
          title="Couldn’t load the dashboard"
          message={error.message}
          onRetry={refetch}
        />
      ) : data ? (
        <>
          {showSetupChecklist(steps) ? (
            <SetupChecklist
              businessId={businessId}
              steps={steps}
              onAddCustomer={() => setAddingCustomer(true)}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <CustomersPanel businessId={businessId} customers={data.summary.customers} />
            <CampaignsPanel businessId={businessId} campaigns={data.summary.campaigns} />
          </div>

          <div className="mt-4 space-y-4">
            <DeliveryPanel messages={data.summary.messages} />
            <RecentCampaigns businessId={businessId} campaigns={data.recentCampaigns} />
          </div>

          <p className="mt-6 text-sm text-muted">
            Need to change the name or contact details?{" "}
            <Link href="/businesses" className="font-medium text-accent hover:underline">
              Edit this business
            </Link>
            .
          </p>
        </>
      ) : null}

      <CustomerFormDialog
        open={addingCustomer}
        onClose={() => setAddingCustomer(false)}
        businessId={businessId}
        onSaved={refetch}
      />
    </PageContainer>
  );
}
```

- [ ] **Step 2: Type-check, lint, build**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
```

Expected: no TypeScript errors (re-run tsc after the build if only stale `.next/types` errors appear); lint 0 errors and the legacy dashboard warning gone (4 legacy warnings remain); the build succeeds with the same route table.

- [ ] **Step 3: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): redesign the Dashboard page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mock, end-to-end tests, spec update and final verification

**Files:**
- Modify: `e2e/helpers/app.ts` (dashboard data derived from the mock state)
- Create: `e2e/dashboard.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`

**Interfaces:**
- Produces from `e2e/helpers/app.ts`: `mockApi` options `dashboards?: Record<string, { campaigns?: Partial<…>; messages?: Partial<…>; recentCampaigns?: MockRecentCampaign[] }>` and `failFirstDashboardGet?: boolean`; the dashboard route now derives `summary.customers` from the mocked customers (`total`, `emailOptedIn` = opted in and not unsubscribed, `smsOptedIn`, `unsubscribed` = `unsubscribedAt` set — mirroring the API) so adding a customer changes the next dashboard response; `MockRecentCampaign` type.

- [ ] **Step 1: Teach the mock to serve a realistic dashboard**

In `e2e/helpers/app.ts`:

1. Add the types and option fields:

```ts
export type MockRecentCampaign = {
  id: string;
  title: string;
  channel: "EMAIL" | "SMS";
  targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  createdAt: string;
};

export type MockDashboardData = {
  campaigns?: Partial<{ total: number; draft: number; queued: number; sent: number; failed: number }>;
  messages?: Partial<{
    totalLogs: number;
    sent: number;
    failed: number;
    pending: number;
    successRate: number | null;
  }>;
  recentCampaigns?: MockRecentCampaign[];
};
```

and add to `ApiMockOptions`:

```ts
  /** Dashboard extras per business id (campaign counts, message counts, recent campaigns). */
  dashboards?: Record<string, MockDashboardData>;
  /** Makes the first dashboard request fail with a 500. */
  failFirstDashboardGet?: boolean;
```

and a state flag `dashboardGetFailed: false` in the `state` object.

2. Replace the static `emptyDashboard(target)` with a function that takes the customers and the extras:

```ts
function dashboardFor(
  target: MockBusiness,
  customers: MockCustomer[],
  extra: MockDashboardData = {},
) {
  const campaigns = { total: 0, draft: 0, queued: 0, sent: 0, failed: 0, ...extra.campaigns };
  const messages = {
    totalLogs: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    successRate: null as number | null,
    ...extra.messages,
  };

  return {
    business: target,
    summary: {
      customers: {
        total: customers.length,
        // Mirrors the API: opted in means consent and no unsubscribe.
        emailOptedIn: customers.filter((item) => item.emailOptIn && !item.unsubscribedAt).length,
        smsOptedIn: customers.filter((item) => item.smsOptIn && !item.unsubscribedAt).length,
        // The API counts everyone with `unsubscribedAt`, including people who never opted in.
        unsubscribed: customers.filter((item) => item.unsubscribedAt).length,
      },
      campaigns,
      messages,
    },
    recentCampaigns: extra.recentCampaigns ?? [],
  };
}
```

3. In the dashboard route handler, first honour `failFirstDashboardGet` (return `json(500, { error: "Dashboard unavailable" })` once, tracked with the state flag), then return `json(200, dashboardFor(match, state.customers[match.id] ?? [], options.dashboards?.[match.id]))`; keep the 404 for unknown businesses. Remove the now-unused `emptyDashboard`.

All existing callers of `mockApi` keep working (new options are optional).

- [ ] **Step 2: `e2e/dashboard.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { business, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");

const optedIn = Array.from({ length: 6 }, (_, index) =>
  customer(`c-${index + 1}`, `Opted${index + 1}`, {
    email: `opted${index + 1}@example.com`,
    emailOptIn: true,
  }),
);
// The API stores people without consent as unsubscribed, so these look "unsubscribed" to it.
const notOptedIn = Array.from({ length: 4 }, (_, index) =>
  customer(`c-${index + 7}`, `Quiet${index + 1}`, { unsubscribedAt: "2026-09-01T00:00:00Z" }),
);

const busyDashboard = {
  campaigns: { total: 4, draft: 1, queued: 1, sent: 1, failed: 1 },
  messages: { totalLogs: 10, sent: 8, failed: 1, pending: 1, successRate: 89 },
  recentCampaigns: [
    {
      id: "k-1",
      title: "Spring sale",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "SENT" as const,
      createdAt: "2026-10-01T12:00:00Z",
    },
    {
      id: "k-2",
      title: "Autumn teaser",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "DRAFT" as const,
      createdAt: "2026-10-05T12:00:00Z",
    },
    {
      id: "k-3",
      title: "Flash offer",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "FAILED" as const,
      createdAt: "2026-10-06T12:00:00Z",
    },
    {
      id: "k-4",
      title: "Weekend deal",
      channel: "EMAIL" as const,
      targetAudience: "ALL" as const,
      status: "QUEUED" as const,
      createdAt: "2026-10-07T12:00:00Z",
    },
  ],
};

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("a new business shows the setup checklist and no delivery data", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    const checklist = page.getByRole("region", { name: "Get started" });
    await expect(checklist).toBeVisible();
    await expect(checklist.getByText("Add your first customer")).toBeVisible();
    await expect(checklist.getByText("Send your first campaign")).toBeVisible();

    await expect(page.getByRole("region", { name: "Customers" })).toContainText("0 customers");
    await expect(page.getByRole("region", { name: "Delivery" })).toContainText("No messages sent yet");
    await expect(page.getByText(/NaN/)).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Messages:/ })).toHaveCount(0);
  });

  test("adding the first customer updates the checklist and the counts", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    const checklist = page.getByRole("region", { name: "Get started" });
    await checklist.getByRole("button", { name: "Add customer" }).click();

    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await dialog.getByLabel("First name").fill("Katherine");
    await dialog.getByLabel("Customer explicitly agreed to receive promotional emails").check();
    await dialog.getByRole("button", { name: "Add customer" }).click();

    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("1 customer");
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("Opted in to email");
    await expect(checklist.getByRole("listitem").first()).toContainText("(done)");
    // The campaign step is still open, so the checklist stays.
    await expect(checklist).toBeVisible();
  });

  test("shows customers, campaigns, delivery and recent campaigns from real numbers", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn, ...notOptedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    // Setup is complete, so the checklist is gone.
    await expect(page.getByRole("region", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);

    const customers = page.getByRole("region", { name: "Customers" });
    await expect(customers).toContainText("10 customers");
    await expect(customers.getByText("Opted in to email")).toBeVisible();
    await expect(customers.locator("div").filter({ hasText: /^Opted in to email6$/ })).toBeVisible();
    // Derived from total - opted in, never the API's "unsubscribed" label.
    await expect(customers.locator("div").filter({ hasText: /^Not opted in4$/ })).toBeVisible();
    await expect(page.getByText("Unsubscribed")).toHaveCount(0);

    const campaigns = page.getByRole("region", { name: "Campaigns" });
    await expect(campaigns).toContainText("4 campaigns");
    for (const status of ["Draft", "Queued", "Sent", "Failed"]) {
      await expect(campaigns.getByText(status, { exact: true })).toBeVisible();
    }

    const delivery = page.getByRole("region", { name: "Delivery" });
    await expect(page.getByRole("img", { name: "Messages: 8 sent, 1 failed, 1 pending" })).toBeVisible();
    await expect(delivery).toContainText("89% success rate");
    await expect(delivery.locator("div").filter({ hasText: /^Sent8 \(80%\)$/ })).toBeVisible();

    const recent = page.getByRole("region", { name: "Recent campaigns" });
    await expect(recent.getByRole("link", { name: "Spring sale" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/analytics",
    );
    await expect(recent.getByRole("link", { name: "Autumn teaser" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-2/preview",
    );
    await expect(recent.getByText("Flash offer")).toBeVisible();
  });

  test("a tiny failed share stays visible in the bar and the legend", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      dashboards: {
        b1: {
          campaigns: { total: 1, sent: 1 },
          messages: { totalLogs: 1001, sent: 1000, failed: 1, pending: 0, successRate: 100 },
        },
      },
    });
    await page.goto("/businesses/b1/dashboard");

    const bar = page.getByRole("img", { name: "Messages: 1000 sent, 1 failed, 0 pending" });
    await expect(bar).toBeVisible();

    const failedSegment = bar.locator('[title^="Failed"]');
    const box = await failedSegment.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(3.5);

    const delivery = page.getByRole("region", { name: "Delivery" });
    await expect(delivery.locator("div").filter({ hasText: /^Failed1 \(0%\)$/ })).toBeVisible();
    await expect(delivery.locator("div").filter({ hasText: /^Pending0 \(0%\)$/ })).toBeVisible();
  });

  test("quick actions open the customer dialog and the campaigns page", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("main").getByRole("button", { name: "Add customer" }).click();
    const dialog = page.getByRole("dialog", { name: "Add customer" });
    await expect(dialog.getByLabel("First name")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("link", { name: "New campaign" }).click();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
  });

  test("a failed load shows an error with a retry", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn] },
      failFirstDashboardGet: true,
    });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("heading", { name: /Couldn.t load the dashboard/ })).toBeVisible();
    await expect(page.getByText("Dashboard unavailable")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("region", { name: "Customers" })).toContainText("6 customers");
  });
});

test.describe("dashboard on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("stacks the panels without horizontal scroll", async ({ page }) => {
    await signIn(page);
    await mockApi(page, {
      businesses: [bakery],
      customers: { b1: [...optedIn, ...notOptedIn] },
      dashboards: { b1: busyDashboard },
    });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("img", { name: /Messages:/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Recent campaigns" })).toBeVisible();
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);
  });
});
```

- [ ] **Step 3: Update the spec**

In `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`:

1. Append to the Dashboard paragraph of section 7: ` Recent campaigns is a responsive list of rows rather than a table. The "Not opted in" figure is derived from the total minus the email-opted-in count, because the API's "unsubscribed" count also includes people who never opted in. A queued campaign shows as "Queued" (the payload has no send date, so "Scheduled" arrives with the campaign list). The delivery chart is a single stacked bar with an icon-and-label legend; its hover tooltip is the native title, and the legend always lists every value.`
2. In section 10, append to the phase 3 line: ` "New campaign" and the recent-campaign links point at the existing campaigns routes until phases 4 and 5 re-point them.`

- [ ] **Step 4: Run everything**

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
- Lint: 0 errors, 4 legacy warnings, none in new files.
- Build: succeeds.
- Playwright: all pass (previously 37; plus 7 dashboard tests = 44).
- `git status --short`: only intended changes.

If a Playwright test fails: diagnose the root cause before changing anything. Do not loosen an assertion. If it reveals a genuine product bug in Tasks 1-4, make the smallest correct fix in its OWN commit, keep the test that exposed it, and describe it (file, symptom, root cause, fix) in the report. Locator note: the customers/delivery row locators use text patterns like `/^Opted in to email6$/`; if the real DOM text differs (for example spacing), adjust the locator, not the assertion's meaning.

- [ ] **Step 5: Visual and keyboard check**

With the mocked API (no real Supabase/API is needed), use a throwaway Playwright script to look at `/businesses/b1/dashboard` with (a) a brand-new business, (b) the busy data, (c) the 1001-message case, at 1280px, 1024px and 375px, light and dark (`colorScheme`). Save screenshots to the scratchpad (not the repo) and view them. Check: the delivery bar has 2px gaps and rounded outer ends, the failed sliver is visible, the legend reads clearly, no horizontal scroll at 375px or 1024px, focus rings are visible when tabbing through the header actions and checklist, and the "Add customer" dialog returns focus to its opener. Record only what you saw; state that authenticated pages were checked with mocks only. Delete any throwaway script before committing.

- [ ] **Step 6: Commit**

```bash
git add e2e docs/superpowers/specs/2026-10-08-ui-redesign-design.md
git commit -m "test(web): cover the Dashboard; document its data rules" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git status --short
```

Expected: clean working tree (`playwright-report/` and `test-results/` restored, no throwaway files).
