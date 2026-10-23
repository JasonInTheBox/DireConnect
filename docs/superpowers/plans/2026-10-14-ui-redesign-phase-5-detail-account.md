# DireConnect UI Redesign, Phase 5: Campaign Detail Tabs and Account Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three legacy dark campaign pages (preview, analytics, logs) with one tabbed campaign detail view (header with status and draft actions, then Audience, Results and Delivery log tabs) built from the shared design system, add a "Review and send" entry point for drafts, and add the Account page (sign-in details, email confirmation, password change, log out) that the wizard's "confirm your email" block can link to.

**Architecture:** A route group `[campaignId]/(detail)/` holds a shared layout that loads the campaign once (the API has no single-campaign endpoint, so it reads the list), shares it through a small context, and renders the header, summary and route-based tabs; the three tab pages and an index redirect live in the group. The wizard pages (`edit`, `send`) stay outside the group and share one view component. Pure logic (tab hrefs, header actions, copy, log status, password validation) lives in `src/lib` and is unit-tested in Node; components stay thin. The Account page talks to Supabase directly (`updateUser`, `resend`, `refreshSession`), mocked in Playwright.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, `@supabase/supabase-js` (already installed), Vitest (node), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (sections 5.1, 6, 7 "Campaign detail" and "Account", 8, 9). Phases 1 to 4 (shell, Businesses, Customers, Dashboard, campaign list and wizard) are merged on `main`; this plan builds on their exact APIs.

## Global Constraints

Carried verbatim from Phases 1 to 4:

- Scope is `apps/web`, `e2e/`, and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts. No new dependencies.
- Light theme by default; dark follows `prefers-color-scheme`. Colours come only from the token utilities (`bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `text-accent-ink`, `bg-accent-soft`, `bg-success`/`text-success`/`bg-success-soft`, `bg-warning`/`text-warning`/`bg-warning-soft`, `bg-danger`/`text-danger`/`bg-danger-soft`, `rounded-control` = 6px, `rounded-container` = 10px, `shadow-float`). No raw `gray-`/`blue-`/`green-`/`red-` classes.
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Touch targets: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths; icon-only buttons `min-h-10 min-w-10`; text links used as controls get `min-h-10` (or are rendered with `buttonClasses`).
- Meaning is never conveyed by colour alone: every status carries an icon and a text label.
- Motion only in response to a user action. Loading indicators are exempt.
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- Copy: active voice, sentence case, the same verb for button and toast where truthful. Errors state what happened and how to fix it; no apologies.
- **Modal convention:** inside a dialog, errors are shown inline; a toast is fired as/after the dialog closes. Unmapped server field errors fall back to `FormError`. A dialog with a request in flight is not dismissible.
- `useApi` returns `{ data, error, loading, slow, refetch }`, scopes its state to the current path, and keeps old data while the same path refetches. `apiFetch<T>(path, { method?, body?, signal? })` throws `ApiError { status, message, details }` and redirects to `/login` on 401. `useBusinesses()` returns `{ businesses, status, error, slow, refetch, addBusiness }`. `useSession()` returns `{ id, email, emailConfirmed }`. `useToast()` returns `{ success, error }`.
- Shell layout: pages render inside `<main id="main-content">`; use `PageContainer` + `PageHeader` (supplies the page's single `<h1>`, with `id="page-title"`). Key page content by `businessId` so state resets on business change.
- Work on branch `ui-redesign-phase-5`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` verbatim (whichever model you are).
- Playwright runs modify the TRACKED `playwright-report/` and `test-results/`; restore them after each run (`git checkout -- playwright-report test-results`) and never commit them.
- `apps/api/src/routes/campaign.test.ts` already fails on `main` because of a stale git-ignored `apps/api/src/config/env.js`; never touch that file. Expect exactly that one failing file in `npm test`.
- In Playwright, the step/section landmarks are labelled regions, so `getByLabel("Message")`-style locators can collide; prefer `getByRole("textbox", { name })`, `getByRole("radio", ...)`, `getByRole("button", ...)`.
- On Windows, move whole directories file by file (`git mv` of a directory can fail with permission errors).
- `apps/web/AGENTS.md` warns this Next.js version differs from older ones; use only patterns already used by existing pages (`useParams`, client pages, `useRouter` from `next/navigation`, `Link`, route groups). Do not introduce `useSearchParams` (it needs a Suspense boundary) or other new Next.js APIs.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

## Review Focus

Inputs and conditions the spec implies but does not spell out, most likely to bite first. Each is pinned by a test in the task named.

1. **A draft's detail view must not offer a one-click send.** The legacy preview page queued with a single button, no confirmation. Sending from a draft must go through the wizard's confirm step only. (Tasks 2 and 3)
2. **Wrong or unreachable campaign ids and non-editable campaigns.** An unknown id shows "Campaign not found"; Edit/Review and send/Delete never appear for queued, sent, failed or SMS campaigns (SMS drafts keep Delete only). (Task 2)
3. **Stale status.** A queued campaign is being delivered while the page is open; the Results tab must be refreshable and the header must refresh with it. (Task 3)
4. **Empty and partial data.** A draft with no results, a queued campaign with no messages yet, a legacy campaign without a recipient snapshot, zero skipped customers, and a failure reason string the UI has never seen must all render sensibly. (Tasks 3 and 4)
5. **Account safety.** Mismatched or empty passwords never reach Supabase; a server refusal (weak or unchanged password) appears next to the field and the form keeps what the user typed; an unconfirmed email can be resent and re-checked; log out works from the page. (Task 5)

## Facts about the APIs this plan relies on

- There is no single-campaign endpoint; `GET /api/businesses/:id/campaigns` returns the list and the detail layout finds the campaign by id.
- `GET .../campaigns/:id/preview`: `{ campaign, summary: { totalCustomers, eligibleCount, skippedCount, skippedByReason, isSnapshot }, eligible[], skipped[] }`, recipients are `{ customerId, recipient, eligible, reason }`. For a campaign that has been queued the data comes from the saved snapshot (`isSnapshot: true`); drafts are computed live (`isSnapshot: false`); old campaigns with no snapshot are computed live too.
- `GET .../campaigns/:id/analytics`: `summary` has `analyticsSource: "SNAPSHOT" | "LEGACY_LOGS"`, `totalRecipientCount`, `eligibleCount`, `skippedBeforeSendCount`, `attemptedSendCount`, `sentCount`, `failedDeliveryCount`, `pendingCount`, `sentRate`, `skippedByReason`, `failedByReason`. `failedByReason` keys are the worker's human-readable `errorMessage` strings (including the daily-limit reasons).
- `GET .../campaigns/:id/logs`: array of message logs `{ id, recipient, channel, status: "PENDING" | "SENT" | "FAILED", errorMessage, sentAt, createdAt, ... }`, newest first. A campaign has at most 10 recipients, so the list is short.
- Delivery limits enforced by the worker (not knowable beforehand): 1 email per recipient, 25 per account, 100 per platform, each per rolling 24 hours. Blocked recipients appear as FAILED logs with a readable `errorMessage`.
- Supabase auth (browser client): `supabase.auth.updateUser({ password })` changes the password for the signed-in user (errors come back as `AuthError` with an English `message`); `supabase.auth.resend({ type: "signup", email })` re-sends the confirmation email; `supabase.auth.refreshSession()` fetches a fresh session whose user carries the current `email_confirmed_at`, and `SessionProvider` picks it up through `onAuthStateChange`. `toSessionUser` derives `emailConfirmed` from `email_confirmed_at`/`confirmed_at`.

## Spec deviations (decided here)

- **Route group for the detail layout.** The spec lists `[campaignId]/layout.tsx`. A layout there would also wrap the wizard pages (`edit`, `send`), which have their own headers. The detail layout therefore lives in `[campaignId]/(detail)/layout.tsx` together with `page.tsx`, `preview`, `analytics` and `logs`. URLs do not change.
- **A `send` route is added** (`/campaigns/[campaignId]/send`) so the header's "Review and send" action opens the existing edit wizard directly on the Review step (no query string, which would need a Suspense boundary). `edit` and `send` share one view component.
- **Route tabs are navigation links, not an ARIA `tablist`.** Each tab is a different page, so the correct pattern is a `nav` with links and `aria-current="page"`; the WAI-ARIA tabs pattern is for in-page panels. Keyboard behaviour is plain link/Tab behaviour.
- **The Audience tab is read-only.** The legacy page's "Queue Campaign" button is removed: queueing happens only in the wizard, after the confirm dialog.
- **Lists are not filtered.** A campaign has at most 10 recipients, so the Delivery log has no search or filter; the Audience tab's two lists paginate at 25 only because a draft preview can list every customer.
- **`Panel`/`PanelRow` move to `components/ui/panel.tsx`** because Results and Account reuse them (the dashboard imports are updated).
- **The "Account" nav group is added to the sidebar** (spec section 6 lists it); the email and Log out stay at the foot.
- **Mirrored limits grow by two constants** (`maxEmailsPerAccountPer24Hours`, `maxEmailsPerPlatformPer24Hours`) for the Delivery log's limits note, covered by the same parity test.

## File structure

New (under `apps/web/src`):

| File | Responsibility |
|---|---|
| `components/ui/panel.tsx` | `Panel`/`PanelRow` (moved from `components/dashboard/panel.tsx`) |
| `components/ui/tabs.tsx` | `LinkTabs`: route-based tab navigation |
| `lib/campaignDetail.ts` | Tab list and hrefs, header actions, tab copy, log status, failure reasons, limits notes |
| `lib/account.ts` | Password form validation and server-error placement |
| `components/shell/use-logout.ts` | Shared log-out action (sidebar and Account) |
| `components/campaigns/detail/campaign-context.tsx` | Context carrying the campaign and a `refetch` |
| `components/campaigns/detail/campaign-header.tsx` | Title, breadcrumbs, draft actions, delete dialog, status summary |
| `components/campaigns/detail/recipient-list.tsx` | Paged list used by the Audience tab |
| `components/campaigns/edit-campaign-view.tsx` | Shared view for the `edit` and `send` pages |
| `app/(app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/layout.tsx` | Loads the campaign; header, summary and tabs |
| `.../(detail)/page.tsx` | Redirect to Audience (drafts) or Results |
| `.../(detail)/preview/page.tsx`, `analytics/page.tsx`, `logs/page.tsx` | The three tabs (rewritten legacy pages) |
| `.../[campaignId]/send/page.tsx` | Wizard opened on the Review step |
| `app/(app)/account/page.tsx` | Account page |
| `e2e/campaign-detail.spec.ts`, `e2e/account.spec.ts` | Behaviour tests |

Modified: `lib/types.ts`, `lib/campaignLimits.ts` (+ test), `lib/campaignWizard.ts` (+ test), `lib/dashboard.ts` (+ test), `components/dashboard/*` (panel import, `DeliveryPanel` empty text), `components/campaigns/wizard/campaign-wizard.tsx`, `components/campaigns/wizard/step-review.tsx`, `components/shell/sidebar.tsx`, `.../[campaignId]/edit/page.tsx`, `e2e/helpers/app.ts`, existing e2e specs that assert draft link targets, the spec.

---

### Task 1: Shared logic and primitives

**Files:**
- Create: `apps/web/src/lib/campaignDetail.ts`, `campaignDetail.test.ts`, `account.ts`, `account.test.ts`, `apps/web/src/components/ui/tabs.tsx`
- Move: `apps/web/src/components/dashboard/panel.tsx` to `apps/web/src/components/ui/panel.tsx`
- Modify: `apps/web/src/lib/types.ts`, `campaignLimits.ts`, `campaignLimits.test.ts`, `apps/web/src/components/dashboard/delivery-panel.tsx`, `customers-panel.tsx`, `campaigns-panel.tsx`, `recent-campaigns.tsx`, `setup-checklist.tsx` (only the files that import `./panel`)

**Interfaces:**
- Consumes: Phase 4 `rowActionsFor`, `skippedReasons`, `plainSkipReason` (`lib/campaignDisplay.ts`), `displayStatusOf` (`lib/campaignStatus.ts`), `formatDateTime` (`lib/schedule.ts`), `CAMPAIGN_LIMITS`, `Campaign`.
- Produces (later tasks rely on these exact names):
  - `types.ts`: `MessageLog`.
  - `campaignLimits.ts`: `CAMPAIGN_LIMITS` gains `maxEmailsPerAccountPer24Hours: 25` and `maxEmailsPerPlatformPer24Hours: 100`.
  - `campaignDetail.ts`: `DetailSegment`, `DETAIL_TABS`, `detailHref(businessId, campaignId, segment?)`, `defaultDetailSegment(status)`, `headerActionsFor(campaign)`, `audienceIntro(campaign, summary)`, `resultsNotes(campaign, now?, timeZone?)`, `LEGACY_ANALYTICS_NOTE`, `sendLimitNotes()`, `logStatusMeta(status)`, `failureReasons(failedByReason)`.
  - `account.ts`: `validatePasswordForm(values)`, `passwordErrorTarget(message)`, `authErrorMessage(error, fallback)`.
  - `components/ui/panel.tsx`: `Panel`, `PanelRow` (same signatures as before).
  - `components/ui/tabs.tsx`: `LinkTabs({ label, items })` with `items: Array<{ href: string; label: string }>`.
  - `DeliveryPanel({ messages, emptyText? })`.

- [ ] **Step 1: Create the branch and move `Panel`**

```bash
git checkout main
git checkout -b ui-redesign-phase-5
git mv apps/web/src/components/dashboard/panel.tsx apps/web/src/components/ui/panel.tsx
```

In every file under `apps/web/src/components/dashboard/` that has `from "./panel"`, change the import to `from "@/components/ui/panel"` (find them with `grep -rn 'from "./panel"' apps/web/src`).

In `apps/web/src/components/dashboard/delivery-panel.tsx` change the signature and the empty text:

```tsx
export function DeliveryPanel({
  messages,
  emptyText = "No messages sent yet. Results appear here after your first campaign goes out.",
}: {
  messages: DashboardSummary["messages"];
  emptyText?: string;
}) {
```

and replace the literal paragraph content with `{emptyText}`:

```tsx
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
```

- [ ] **Step 2: Add the type and the limits**

Append to `apps/web/src/lib/types.ts`:

```ts
export type MessageLog = {
  id: string;
  ownerId: string;
  businessId: string;
  campaignId: string;
  customerId?: string | null;
  channel: CampaignChannel;
  recipient: string;
  status: "PENDING" | "SENT" | "FAILED";
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Replace `apps/web/src/lib/campaignLimits.ts` with:

```ts
/**
 * Mirrors CAMPAIGN_EMAIL_SAFETY_LIMITS in packages/validation/src/campaignSafety.ts.
 * apps/web does not depend on that package; campaignLimits.test.ts fails if the values drift.
 */
export const CAMPAIGN_LIMITS = {
  maxRecipientsPerCampaign: 10,
  maxEmailsPerRecipientPer24Hours: 1,
  maxEmailsPerAccountPer24Hours: 25,
  maxEmailsPerPlatformPer24Hours: 100,
} as const;
```

Replace the test body in `apps/web/src/lib/campaignLimits.test.ts` with:

```ts
describe("CAMPAIGN_LIMITS", () => {
  it("mirrors the API's email safety limits", () => {
    expect(CAMPAIGN_LIMITS.maxRecipientsPerCampaign).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxRecipientsPerCampaign,
    );
    expect(CAMPAIGN_LIMITS.maxEmailsPerRecipientPer24Hours).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxEmailsPerRecipientPer24Hours,
    );
    expect(CAMPAIGN_LIMITS.maxEmailsPerAccountPer24Hours).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxEmailsPerAccountPer24Hours,
    );
    expect(CAMPAIGN_LIMITS.maxEmailsPerPlatformPer24Hours).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxEmailsPerPlatformPer24Hours,
    );
  });
});
```

(keep the file's existing imports).

- [ ] **Step 3: Write the failing tests**

Create `apps/web/src/lib/campaignDetail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  audienceIntro,
  DETAIL_TABS,
  defaultDetailSegment,
  detailHref,
  failureReasons,
  headerActionsFor,
  logStatusMeta,
  resultsNotes,
  sendLimitNotes,
} from "./campaignDetail";

const now = new Date("2030-01-15T12:00:00.000Z");

describe("tabs and hrefs", () => {
  it("lists Audience, Results and Delivery log in order", () => {
    expect(DETAIL_TABS.map((tab) => tab.label)).toEqual(["Audience", "Results", "Delivery log"]);
    expect(DETAIL_TABS.map((tab) => tab.segment)).toEqual(["preview", "analytics", "logs"]);
  });

  it("builds campaign hrefs", () => {
    expect(detailHref("b1", "k-1")).toBe("/businesses/b1/campaigns/k-1");
    expect(detailHref("b1", "k-1", "analytics")).toBe("/businesses/b1/campaigns/k-1/analytics");
    expect(detailHref("b1", "k-1", "send")).toBe("/businesses/b1/campaigns/k-1/send");
  });

  it("opens drafts on Audience and everything else on Results", () => {
    expect(defaultDetailSegment("DRAFT")).toBe("preview");
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(defaultDetailSegment(status)).toBe("analytics");
    }
  });
});

describe("headerActionsFor", () => {
  it("offers edit, send and delete for an email draft", () => {
    expect(headerActionsFor({ status: "DRAFT", channel: "EMAIL" })).toEqual({
      edit: true,
      send: true,
      remove: true,
    });
  });

  it("offers only delete for an SMS draft", () => {
    expect(headerActionsFor({ status: "DRAFT", channel: "SMS" })).toEqual({
      edit: false,
      send: false,
      remove: true,
    });
  });

  it("offers nothing once a campaign is queued, sent or failed", () => {
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(headerActionsFor({ status, channel: "EMAIL" })).toEqual({
        edit: false,
        send: false,
        remove: false,
      });
    }
  });
});

describe("audienceIntro", () => {
  it("explains a live draft preview", () => {
    expect(audienceIntro({ status: "DRAFT" }, { isSnapshot: false })).toMatch(/right now/);
  });

  it("explains a saved recipient list", () => {
    expect(audienceIntro({ status: "SENT" }, { isSnapshot: true })).toMatch(/fixed when the campaign was queued/);
  });

  it("explains an older campaign without a saved list", () => {
    expect(audienceIntro({ status: "SENT" }, { isSnapshot: false })).toMatch(/older campaign/);
  });
});

describe("resultsNotes", () => {
  it("always explains background delivery and daily limits", () => {
    const notes = resultsNotes({ status: "SENT", sendAt: null }, now, "UTC");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/background/);
    expect(notes[0]).toMatch(/Daily sending limits/);
  });

  it("says when a campaign is queued or scheduled", () => {
    expect(resultsNotes({ status: "QUEUED", sendAt: null }, now, "UTC")[0]).toMatch(/queued and waiting/);
    const scheduled = resultsNotes({ status: "QUEUED", sendAt: "2030-02-01T09:30:00.000Z" }, now, "UTC");
    expect(scheduled).toHaveLength(2);
    expect(scheduled[0]).toMatch(/scheduled for Feb 1, 2030/);
  });
});

describe("sendLimitNotes", () => {
  it("states the mirrored limits", () => {
    const notes = sendLimitNotes();
    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatch(/one campaign email every 24 hours/);
    expect(notes[1]).toContain("25");
    expect(notes[2]).toContain("100");
  });
});

describe("logStatusMeta", () => {
  it("gives every log status its own label, tone and icon", () => {
    expect(logStatusMeta("SENT")).toEqual({ label: "Sent", tone: "success", icon: "check" });
    expect(logStatusMeta("FAILED")).toEqual({ label: "Failed", tone: "danger", icon: "alert" });
    expect(logStatusMeta("PENDING")).toEqual({ label: "Pending", tone: "warning", icon: "clock" });
  });
});

describe("failureReasons", () => {
  it("keeps the worker's wording, most common first", () => {
    expect(
      failureReasons({
        "Daily limit reached for this account": 1,
        "Mailbox does not exist": 3,
        "Another reason": 1,
      }),
    ).toEqual([
      { label: "Mailbox does not exist", count: 3 },
      { label: "Another reason", count: 1 },
      { label: "Daily limit reached for this account", count: 1 },
    ]);
  });

  it("returns nothing when there were no failures", () => {
    expect(failureReasons({})).toEqual([]);
  });
});
```

Create `apps/web/src/lib/account.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authErrorMessage, passwordErrorTarget, validatePasswordForm } from "./account";

describe("validatePasswordForm", () => {
  it("accepts a matching, non-empty pair", () => {
    expect(validatePasswordForm({ password: "correct horse", confirm: "correct horse" })).toEqual({});
  });

  it("asks for a password and for the repeat", () => {
    expect(validatePasswordForm({ password: "", confirm: "" })).toEqual({
      password: "Enter a new password.",
      confirm: "Repeat the new password.",
    });
  });

  it("refuses a mismatch", () => {
    expect(validatePasswordForm({ password: "one", confirm: "two" })).toEqual({
      confirm: "The passwords don’t match.",
    });
  });

  it("does not call an empty password a mismatch", () => {
    expect(validatePasswordForm({ password: "", confirm: "x" })).toEqual({
      password: "Enter a new password.",
    });
  });
});

describe("passwordErrorTarget", () => {
  it("puts password problems on the password field and everything else on the form", () => {
    expect(passwordErrorTarget("Password should be at least 6 characters.")).toBe("password");
    expect(passwordErrorTarget("New password should be different from the old password.")).toBe(
      "password",
    );
    expect(passwordErrorTarget("Auth session missing!")).toBe("form");
  });
});

describe("authErrorMessage", () => {
  it("uses an error's own message, or the fallback", () => {
    expect(authErrorMessage(new Error("Nope"), "Fallback")).toBe("Nope");
    expect(authErrorMessage(new Error(""), "Fallback")).toBe("Fallback");
    expect(authErrorMessage("weird", "Fallback")).toBe("Fallback");
    expect(authErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
```

- [ ] **Step 4: Run to see them fail**

Run: `npx vitest run apps/web/src/lib/campaignDetail.test.ts apps/web/src/lib/account.test.ts apps/web/src/lib/campaignLimits.test.ts`
Expected: FAIL (modules `./campaignDetail`, `./account` not found; the limits parity assertions fail on the old constants only if the package exports differ, otherwise they pass after Step 2).

- [ ] **Step 5: Implement the logic**

Create `apps/web/src/lib/campaignDetail.ts`:

```ts
import { rowActionsFor } from "./campaignDisplay";
import { CAMPAIGN_LIMITS } from "./campaignLimits";
import { displayStatusOf } from "./campaignStatus";
import { formatDateTime } from "./schedule";
import type { Campaign, CampaignPreviewResponse, MessageLog } from "./types";

export type DetailSegment = "preview" | "analytics" | "logs";

export const DETAIL_TABS: ReadonlyArray<{ segment: DetailSegment; label: string }> = [
  { segment: "preview", label: "Audience" },
  { segment: "analytics", label: "Results" },
  { segment: "logs", label: "Delivery log" },
];

export function detailHref(
  businessId: string,
  campaignId: string,
  segment?: DetailSegment | "edit" | "send",
): string {
  const base = `/businesses/${businessId}/campaigns/${campaignId}`;
  return segment ? `${base}/${segment}` : base;
}

/** Drafts open on the audience; everything else opens on the results. */
export function defaultDetailSegment(status: Campaign["status"]): "preview" | "analytics" {
  return status === "DRAFT" ? "preview" : "analytics";
}

/** Draft-only actions; an SMS draft (SMS is paused) can only be deleted. */
export function headerActionsFor(campaign: Pick<Campaign, "status" | "channel">): {
  edit: boolean;
  send: boolean;
  remove: boolean;
} {
  const actions = rowActionsFor(campaign);
  return {
    edit: actions.includes("edit"),
    send: actions.includes("edit"),
    remove: actions.includes("delete"),
  };
}

export function audienceIntro(
  campaign: Pick<Campaign, "status">,
  summary: Pick<CampaignPreviewResponse["summary"], "isSnapshot">,
): string {
  if (campaign.status === "DRAFT") {
    return "This is who would receive the campaign right now. It’s checked again when you send.";
  }
  if (summary.isSnapshot) {
    return "These are the recipients that were fixed when the campaign was queued.";
  }
  return "This is an older campaign without a saved recipient list, so this shows how your customers would be matched today.";
}

export function resultsNotes(
  campaign: Pick<Campaign, "status" | "sendAt">,
  now: Date = new Date(),
  timeZone?: string,
): string[] {
  const notes: string[] = [];
  const key = displayStatusOf(campaign, now);

  if (key === "SCHEDULED" && campaign.sendAt) {
    notes.push(
      `This campaign is scheduled for ${formatDateTime(campaign.sendAt, timeZone)}. Results appear once it starts sending.`,
    );
  } else if (key === "QUEUED") {
    notes.push("This campaign is queued and waiting to be sent. Results appear as messages go out.");
  }

  notes.push(
    "Delivery happens in the background, so these numbers can lag behind. Daily sending limits can mark some recipients as failed; the delivery log gives the reason for each.",
  );
  return notes;
}

export const LEGACY_ANALYTICS_NOTE =
  "This is an older campaign without a saved recipient list, so these numbers are estimated from its message logs.";

/** The sending limits that can make a delivery fail, for the Delivery log's explanation. */
export function sendLimitNotes(): string[] {
  const {
    maxEmailsPerRecipientPer24Hours,
    maxEmailsPerAccountPer24Hours,
    maxEmailsPerPlatformPer24Hours,
  } = CAMPAIGN_LIMITS;

  return [
    `Each customer can receive ${maxEmailsPerRecipientPer24Hours === 1 ? "one" : maxEmailsPerRecipientPer24Hours} campaign email every 24 hours.`,
    `Your account can send up to ${maxEmailsPerAccountPer24Hours} campaign emails every 24 hours.`,
    `DireConnect as a whole can send up to ${maxEmailsPerPlatformPer24Hours} campaign emails every 24 hours.`,
  ];
}

export function logStatusMeta(status: MessageLog["status"]): {
  label: string;
  tone: "success" | "danger" | "warning";
  icon: "check" | "alert" | "clock";
} {
  switch (status) {
    case "SENT":
      return { label: "Sent", tone: "success", icon: "check" };
    case "FAILED":
      return { label: "Failed", tone: "danger", icon: "alert" };
    default:
      return { label: "Pending", tone: "warning", icon: "clock" };
  }
}

/** Failure reasons keep the worker's own wording (it is already plain language), most common first. */
export function failureReasons(
  failedByReason: Record<string, number>,
): Array<{ label: string; count: number }> {
  return Object.entries(failedByReason)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
```

Create `apps/web/src/lib/account.ts`:

```ts
export type PasswordFormValues = { password: string; confirm: string };

export function validatePasswordForm(values: PasswordFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.password) {
    errors.password = "Enter a new password.";
  }
  if (!values.confirm) {
    errors.confirm = "Repeat the new password.";
  } else if (values.password && values.confirm !== values.password) {
    errors.confirm = "The passwords don’t match.";
  }
  return errors;
}

/** Supabase explains password problems in plain English; those belong beside the field. */
export function passwordErrorTarget(message: string): "password" | "form" {
  return /password/i.test(message) ? "password" : "form";
}

export function authErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
```

- [ ] **Step 6: Add `LinkTabs`**

Create `apps/web/src/components/ui/tabs.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavActive } from "@/lib/navigation";

/**
 * Tabs that are separate pages: a navigation landmark of links with `aria-current="page"`.
 * (The WAI-ARIA tablist pattern is for panels on one page; this is page navigation.)
 */
export function LinkTabs({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors",
                  active
                    ? "text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent"
                    : "text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 7: Run the checks**

Run: `npx vitest run apps/web` then `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`
Expected: all pass; tsc exit 0 (the dashboard imports must resolve after the move); lint 0 errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): add campaign detail and account logic, link tabs and a shared panel

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Campaign detail shell, Review-and-send route and draft actions

**Files:**
- Create: `apps/web/src/components/campaigns/detail/campaign-context.tsx`, `campaign-header.tsx`, `apps/web/src/components/campaigns/edit-campaign-view.tsx`, `apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/layout.tsx`, `(detail)/page.tsx`, `apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]/send/page.tsx`, `e2e/campaign-detail.spec.ts`
- Move (file by file): `[campaignId]/preview/page.tsx`, `analytics/page.tsx`, `logs/page.tsx` into `[campaignId]/(detail)/preview/page.tsx`, `(detail)/analytics/page.tsx`, `(detail)/logs/page.tsx` (their content is rewritten in Tasks 3 and 4; moving keeps URLs working)
- Modify: `[campaignId]/edit/page.tsx` (use the shared view), `apps/web/src/components/campaigns/wizard/campaign-wizard.tsx` (`initialStep` prop)

**Interfaces:**
- Consumes: Task 1 (`LinkTabs`, `DETAIL_TABS`, `detailHref`, `defaultDetailSegment`, `headerActionsFor`), Phase 4 (`CampaignWizard`, `editBlockReason`, `whenLabel`, `CampaignStatusBadge`, `channelLabel`, `ConfirmDialog`), `useApi`, `PageContainer/PageHeader`.
- Produces:
  - `CampaignProvider({ campaign, refetch, children })` and `useCampaign(): { campaign: Campaign; refetch: () => void }`.
  - `CampaignHeader({ businessId, businessName, campaign })` (renders breadcrumbs, `<h1>`, draft actions, delete dialog, status row).
  - `EditCampaignView({ businessId, campaignId, mode })` with `mode: "edit" | "send"`.
  - `CampaignWizard` prop `initialStep?: WizardStepId` (default `"basics"`).

- [ ] **Step 1: Move the legacy pages into the group**

```bash
D="apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]"
mkdir -p "$D/(detail)/preview" "$D/(detail)/analytics" "$D/(detail)/logs"
for p in preview analytics logs; do git mv "$D/$p/page.tsx" "$D/(detail)/$p/page.tsx"; done
ls "$D" "$D/(detail)"
```

(Move file by file; remove the now-empty `preview`, `analytics` and `logs` folders if the shell left them.)

- [ ] **Step 2: The context and the header**

Create `apps/web/src/components/campaigns/detail/campaign-context.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Campaign } from "@/lib/types";

type CampaignContextValue = { campaign: Campaign; refetch: () => void };

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({
  campaign,
  refetch,
  children,
}: CampaignContextValue & { children: ReactNode }) {
  return <CampaignContext.Provider value={{ campaign, refetch }}>{children}</CampaignContext.Provider>;
}

/** The campaign the detail layout loaded, plus a way to reload it (for example after delivery progresses). */
export function useCampaign(): CampaignContextValue {
  const value = useContext(CampaignContext);
  if (!value) {
    throw new Error("useCampaign must be used inside the campaign detail layout");
  }
  return value;
}
```

Create `apps/web/src/components/campaigns/detail/campaign-header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import { detailHref, headerActionsFor } from "@/lib/campaignDetail";
import { whenLabel } from "@/lib/campaignDisplay";
import { channelLabel } from "@/lib/campaignStatus";
import type { Campaign } from "@/lib/types";

export function CampaignHeader({
  businessId,
  businessName,
  campaign,
}: {
  businessId: string;
  businessName: string;
  campaign: Campaign;
}) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
  const actions = headerActionsFor(campaign);
  const listHref = `/businesses/${businessId}/campaigns`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: listHref },
          { label: campaign.title },
        ]}
        title={campaign.title}
        actions={
          actions.send || actions.edit || actions.remove ? (
            <>
              {actions.send ? (
                <Link
                  href={detailHref(businessId, campaign.id, "send")}
                  className={buttonClasses({ variant: "primary" })}
                >
                  <Icon name="send" />
                  Review and send
                </Link>
              ) : null}
              {actions.edit ? (
                <Link
                  href={detailHref(businessId, campaign.id, "edit")}
                  className={buttonClasses({ variant: "secondary" })}
                >
                  <Icon name="edit" />
                  Edit
                </Link>
              ) : null}
              {actions.remove ? (
                <Button variant="secondary" onClick={() => setDeleting(true)}>
                  <Icon name="trash" />
                  Delete
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <section aria-label="Campaign summary" className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
          <Badge>{channelLabel(campaign.channel)}</Badge>
          <span className="text-muted">{whenLabel(campaign)}</span>
          {campaign.channel === "SMS" ? (
            <span className="text-muted">SMS sending is paused</span>
          ) : null}
        </div>
        <p className="line-clamp-3 max-w-prose whitespace-pre-wrap break-words text-sm text-muted">
          {campaign.message}
        </p>
      </section>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${campaign.title}”?`}
        description="This removes the draft. This can’t be undone."
        confirmLabel="Delete campaign"
        onConfirm={async () => {
          await apiFetch(`/api/businesses/${businessId}/campaigns/${campaign.id}`, {
            method: "DELETE",
          });
          toast.success("Campaign deleted");
          router.push(listHref);
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: The layout and the index redirect**

Create `apps/web/src/app/(app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/layout.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { CampaignProvider } from "@/components/campaigns/detail/campaign-context";
import { CampaignHeader } from "@/components/campaigns/detail/campaign-header";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { LinkTabs } from "@/components/ui/tabs";
import { DETAIL_TABS, detailHref } from "@/lib/campaignDetail";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignDetailLayout({ children }: { children: ReactNode }) {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  // Keyed so a different campaign or business never shows the previous one's state.
  return (
    <CampaignDetailShell key={`${businessId}/${campaignId}`} businessId={businessId} campaignId={campaignId}>
      {children}
    </CampaignDetailShell>
  );
}

function CampaignDetailShell({
  businessId,
  campaignId,
  children,
}: {
  businessId: string;
  campaignId: string;
  children: ReactNode;
}) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  // The API has no single-campaign endpoint, so read the list and find the campaign.
  const { data, error, slow, refetch } = useApi<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
  const campaign = data?.find((item) => item.id === campaignId) ?? null;

  if (data === null && error === null) {
    return (
      <PageContainer>
        <ListSkeleton rows={4} slow={slow} />
      </PageContainer>
    );
  }
  if (data === null && error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn’t load the campaign" message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }
  if (!campaign) {
    return (
      <PageContainer>
        <EmptyState
          title="Campaign not found"
          description="This campaign doesn’t exist or was deleted."
          action={
            <Link
              href={`/businesses/${businessId}/campaigns`}
              className={buttonClasses({ variant: "primary" })}
            >
              Back to campaigns
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <CampaignProvider campaign={campaign} refetch={refetch}>
      <PageContainer>
        <CampaignHeader businessId={businessId} businessName={businessName} campaign={campaign} />
        <LinkTabs
          label="Campaign sections"
          items={DETAIL_TABS.map((tab) => ({
            href: detailHref(businessId, campaign.id, tab.segment),
            label: tab.label,
          }))}
        />
        <div className="mt-6">{children}</div>
      </PageContainer>
    </CampaignProvider>
  );
}
```

Create `.../[campaignId]/(detail)/page.tsx`:

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { ListSkeleton } from "@/components/ui/skeleton";
import { defaultDetailSegment, detailHref } from "@/lib/campaignDetail";

/** Bookmarks and old links to the campaign itself land on Audience (drafts) or Results. */
export default function CampaignIndexPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const { campaign } = useCampaign();
  const router = useRouter();

  useEffect(() => {
    router.replace(detailHref(businessId, campaign.id, defaultDetailSegment(campaign.status)));
  }, [router, businessId, campaign.id, campaign.status]);

  return <ListSkeleton rows={2} />;
}
```

- [ ] **Step 4: The shared edit/send view and pages**

Create `apps/web/src/components/campaigns/edit-campaign-view.tsx` (moved from the Phase 4 edit page, with a mode):

```tsx
"use client";

import Link from "next/link";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { editBlockReason } from "@/lib/campaignDisplay";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const COPY = {
  edit: {
    title: "Edit campaign",
    description: "Changes are saved to the draft. Nothing is sent until you confirm on the last step.",
    initialStep: "basics" as const,
  },
  send: {
    title: "Review and send",
    description: "Check who will receive it, then choose when it goes out.",
    initialStep: "review" as const,
  },
};

/** The wizard for an existing draft: opened on the first step to edit, or on the last step to send. */
export function EditCampaignView({
  businessId,
  campaignId,
  mode,
}: {
  businessId: string;
  campaignId: string;
  mode: "edit" | "send";
}) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const listHref = `/businesses/${businessId}/campaigns`;
  const copy = COPY[mode];
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
          ...(campaign
            ? [{ label: campaign.title, href: `/businesses/${businessId}/campaigns/${campaign.id}` }]
            : []),
          { label: copy.title },
        ]}
        title={copy.title}
        description={copy.description}
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
          initialStep={copy.initialStep}
        />
      )}
    </PageContainer>
  );
}
```

Replace `.../[campaignId]/edit/page.tsx` with:

```tsx
"use client";

import { useParams } from "next/navigation";
import { EditCampaignView } from "@/components/campaigns/edit-campaign-view";

export default function EditCampaignPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  return (
    <EditCampaignView
      key={`${businessId}/${campaignId}`}
      businessId={businessId}
      campaignId={campaignId}
      mode="edit"
    />
  );
}
```

Create `.../[campaignId]/send/page.tsx` with the same file content except the component name `SendCampaignPage` and `mode="send"`.

- [ ] **Step 5: The wizard's `initialStep` prop**

In `apps/web/src/components/campaigns/wizard/campaign-wizard.tsx`:

1. Add `initialStep = "basics"` to the props (type `initialStep?: WizardStepId`):

```tsx
export function CampaignWizard({
  businessId,
  businessName,
  campaign,
  initialStep = "basics",
}: {
  businessId: string;
  businessName: string;
  /** The draft being edited, or null to create a new campaign. */
  campaign: Campaign | null;
  /** Edit mode can open on the Review step (the "Review and send" action). */
  initialStep?: WizardStepId;
}) {
```

2. Change the step state initialiser to start on that step (the `shownStep` ref already reads `stepIndex`, so no focus jump on first render):

```tsx
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, WIZARD_STEPS.findIndex((item) => item.id === initialStep)),
  );
```

Everything else is unchanged: `isReview && draftId` already starts the preview request, and `draftId` is the campaign's id in edit mode.

- [ ] **Step 6: Write the e2e tests**

Create `e2e/campaign-detail.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const people = [
  customer("c-1", "Ada", { email: "ada@example.com", emailOptIn: true }),
  customer("c-2", "Grace", { email: "grace@navy.test", emailOptIn: true }),
];

const draft = campaign("k-1", "Spring menu", { message: "Blossom buns are back." });
const sent = campaign("k-4", "Loyalty thanks", {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
});
const legacySms = campaign("k-6", "Text blast", { channel: "SMS" });

test.describe("campaign detail", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("shows the title, status, message and the three tabs", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByRole("heading", { level: 1, name: "Spring menu" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Campaign summary" });
    await expect(summary).toContainText("Draft");
    await expect(summary).toContainText("Email");
    await expect(summary).toContainText("Not scheduled");
    await expect(summary).toContainText("Blossom buns are back.");

    const tabs = page.getByRole("navigation", { name: "Campaign sections" });
    await expect(tabs.getByRole("link", { name: "Audience" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/preview",
    );
    await expect(tabs.getByRole("link", { name: "Results" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/analytics",
    );
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/logs",
    );
    await expect(tabs.getByRole("link", { name: "Audience" })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Results" }).click();
    await expect(page).toHaveURL(/\/campaigns\/k-1\/analytics$/);
    await expect(tabs.getByRole("link", { name: "Results" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Spring menu" })).toBeVisible();
  });

  test("the campaign address redirects to Audience for drafts and Results for the rest", async ({
    page,
  }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft, sent] } });

    await page.goto("/businesses/b1/campaigns/k-1");
    await expect(page).toHaveURL(/\/campaigns\/k-1\/preview$/);

    await page.goto("/businesses/b1/campaigns/k-4");
    await expect(page).toHaveURL(/\/campaigns\/k-4\/analytics$/);
  });

  test("an unknown campaign explains itself and links back", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/nope/preview");

    await expect(page.getByRole("heading", { name: "Campaign not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to campaigns" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns",
    );
  });

  test("draft actions: Review and send opens the wizard on the Review step", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people }, campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/edit",
    );
    await page.getByRole("link", { name: "Review and send" }).click();

    await expect(page).toHaveURL(/\/campaigns\/k-1\/send$/);
    await expect(page.getByRole("heading", { level: 1, name: "Review and send" })).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toContainText("Review and send");
    await expect(page.getByText("2 customers will receive this campaign")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeEnabled();
  });

  test("the send route refuses a campaign that is already sent", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] } });
    await page.goto("/businesses/b1/campaigns/k-4/send");

    await expect(page.getByRole("heading", { name: "This campaign can’t be edited" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
  });

  test("a draft can be deleted after confirming, and the user lands on the list", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await dialog.getByRole("button", { name: "Delete campaign" }).click();

    await expect(page.getByText("Campaign deleted")).toBeVisible();
    await expect(page).toHaveURL(/\/businesses\/b1\/campaigns$/);
    expect(
      state.requests.some(
        (request) => request.method === "DELETE" && request.path === "/api/businesses/b1/campaigns/k-1",
      ),
    ).toBe(true);
  });

  test("a sent campaign offers no actions, and an SMS draft offers only Delete", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent, legacySms] } });

    await page.goto("/businesses/b1/campaigns/k-4/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Loyalty thanks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await page.goto("/businesses/b1/campaigns/k-6/preview");
    await expect(page.getByText("SMS sending is paused")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
  });
});
```

(The legacy tab content still renders below the header at this point; the tests above only assert the shell. Tasks 3 and 4 replace it.)

- [ ] **Step 7: Run everything**

Run: `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`
Expected: exit 0; 0 lint errors (the legacy pages' warnings may drop or stay).

Run: `npx playwright test e2e/campaign-detail.spec.ts e2e/campaign-wizard.spec.ts e2e/campaigns.spec.ts` then `git checkout -- playwright-report test-results`
Expected: all pass. If a Phase 4 wizard test breaks because the edit page changed, fix the cause (the edit behaviour must be identical).

Run: `npx playwright test` then `git checkout -- playwright-report test-results`
Expected: 87 existing plus 7 new, all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): add the tabbed campaign detail shell and the Review and send route

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Audience and Results tabs

**Files:**
- Create: `apps/web/src/components/campaigns/detail/recipient-list.tsx`
- Modify (full rewrite): `.../(detail)/preview/page.tsx`, `.../(detail)/analytics/page.tsx`
- Modify: `e2e/helpers/app.ts` (preview snapshot for non-drafts, richer analytics), `e2e/campaign-detail.spec.ts` (append)

**Interfaces:**
- Consumes: Task 1 (`audienceIntro`, `resultsNotes`, `LEGACY_ANALYTICS_NOTE`, `failureReasons`, `Panel`, `PanelRow`, `DeliveryPanel` with `emptyText`), Phase 4 (`skippedReasons`, `plainSkipReason`, `pluralize`), `useCampaign`, `paginate`, `Pagination`, `useApi`.
- Produces: `RecipientList({ title, items, emptyText })` with `items: Array<{ key: string; primary: string; secondary?: string }>`; mock helper options `analytics` entries accept `skippedByReason`, `failedByReason`, `analyticsSource`.

- [ ] **Step 1: Extend the mock**

In `e2e/helpers/app.ts`:

1. Extend `MockAnalytics`:

```ts
export type MockAnalytics = Partial<{
  eligibleCount: number;
  sentCount: number;
  failedDeliveryCount: number;
  pendingCount: number;
  skippedBeforeSendCount: number;
  skippedByReason: Record<string, number>;
  failedByReason: Record<string, number>;
  analyticsSource: "SNAPSHOT" | "LEGACY_LOGS";
}>;
```

2. In the analytics route handler, replace the hard-coded `skippedByReason: {}, failedByReason: {}` and `analyticsSource: "SNAPSHOT"` / `hasSnapshot: true` so the options win: build `const { skippedByReason = {}, failedByReason = {}, analyticsSource = "SNAPSHOT", ...counts } = options.analytics?.[campaignId] ?? {}` and spread `skippedByReason`, `failedByReason`, `analyticsSource`, `hasSnapshot: analyticsSource === "SNAPSHOT"` into the summary; compute the numbers from `counts` with the same zero defaults as before.

3. Make `previewFor` report a snapshot for campaigns that have been queued: change `isSnapshot: false` to `isSnapshot: target.status !== "DRAFT"` (the data itself stays derived from the current customers, which is enough for tests).

- [ ] **Step 2: The recipient list**

Create `apps/web/src/components/campaigns/detail/recipient-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/customers";

const PAGE_SIZE = 25;

export type RecipientItem = { key: string; primary: string; secondary?: string };

/** A short titled list that pages itself (a draft preview can list every customer). */
export function RecipientList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: RecipientItem[];
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const visible = paginate(items, page, PAGE_SIZE);

  return (
    <section
      aria-label={title}
      className="rounded-container border border-line bg-surface p-5"
    >
      <h3 className="text-sm font-semibold text-ink">
        {title} <span className="font-normal text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line">
            {visible.items.map((item) => (
              <li key={item.key} className="py-2 first:pt-0 last:pb-0">
                <p className="break-words text-sm text-ink">{item.primary}</p>
                {item.secondary ? (
                  <p className="text-[13px] text-muted">{item.secondary}</p>
                ) : null}
              </li>
            ))}
          </ul>
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
    </section>
  );
}
```

- [ ] **Step 3: The Audience tab**

Replace `.../(detail)/preview/page.tsx` entirely with:

```tsx
"use client";

import { useParams } from "next/navigation";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { RecipientList } from "@/components/campaigns/detail/recipient-list";
import { Panel, PanelRow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { audienceIntro } from "@/lib/campaignDetail";
import { plainSkipReason, skippedReasons } from "@/lib/campaignDisplay";
import type { CampaignPreviewResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignAudiencePage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { campaign } = useCampaign();
  const { data, error, slow, refetch } = useApi<CampaignPreviewResponse>(
    `/api/businesses/${businessId}/campaigns/${campaignId}/preview`,
  );

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the audience" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const { summary } = data;
  const reasons = skippedReasons(summary.skippedByReason);

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-muted">{audienceIntro(campaign, summary)}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel id="audience-summary-heading" title="Summary">
          <dl className="mt-3 space-y-2 text-sm">
            <PanelRow label="Customers checked" value={summary.totalCustomers} />
            <PanelRow label="Will receive it" value={summary.eligibleCount} />
            <PanelRow label="Skipped" value={summary.skippedCount} />
          </dl>
        </Panel>

        <Panel id="audience-reasons-heading" title="Why customers were skipped">
          {reasons.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No customers were skipped.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {reasons.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecipientList
          title="Recipients"
          emptyText="No customers can receive this campaign."
          items={data.eligible.map((person) => ({
            key: person.customerId,
            primary: person.recipient ?? "No email address",
          }))}
        />
        <RecipientList
          title="Skipped customers"
          emptyText="No customers were skipped."
          items={data.skipped.map((person) => ({
            key: person.customerId,
            primary: person.recipient ?? "No email address",
            secondary: plainSkipReason(person.reason),
          }))}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: The Results tab**

Replace `.../(detail)/analytics/page.tsx` entirely with:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Panel, PanelRow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import {
  detailHref,
  failureReasons,
  headerActionsFor,
  LEGACY_ANALYTICS_NOTE,
  resultsNotes,
} from "@/lib/campaignDetail";
import { skippedReasons } from "@/lib/campaignDisplay";
import type { CampaignAnalyticsResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignResultsPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { campaign, refetch: refetchCampaign } = useCampaign();
  const isDraft = campaign.status === "DRAFT";
  // A draft has nothing to report, so do not ask.
  const { data, error, slow, refetch } = useApi<CampaignAnalyticsResponse>(
    isDraft ? null : `/api/businesses/${businessId}/campaigns/${campaignId}/analytics`,
  );

  if (isDraft) {
    const canSend = headerActionsFor(campaign).send;
    return (
      <EmptyState
        icon="send"
        title="No results yet"
        description="Results appear here after the campaign is sent."
        action={
          canSend ? (
            <Link
              href={detailHref(businessId, campaign.id, "send")}
              className={buttonClasses({ variant: "primary" })}
            >
              Review and send
            </Link>
          ) : undefined
        }
      />
    );
  }

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the results" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const { summary } = data;
  const skipped = skippedReasons(summary.skippedByReason);
  const failures = failureReasons(summary.failedByReason);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose space-y-1">
          {resultsNotes(campaign).map((note) => (
            <p key={note} className="text-sm text-muted">
              {note}
            </p>
          ))}
          {summary.analyticsSource === "LEGACY_LOGS" ? (
            <p className="text-sm text-ink">{LEGACY_ANALYTICS_NOTE}</p>
          ) : null}
        </div>
        <Button
          onClick={() => {
            refetch();
            refetchCampaign();
          }}
        >
          <Icon name="clock" />
          Refresh
        </Button>
      </div>

      <DeliveryPanel
        messages={{
          totalLogs: summary.totalLogCount,
          sent: summary.sentCount,
          failed: summary.failedDeliveryCount,
          pending: summary.pendingCount,
          successRate: summary.sentRate,
        }}
        emptyText="No messages have gone out yet. They appear here as the campaign is delivered."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel id="results-recipients-heading" title="Recipients">
          <dl className="mt-3 space-y-2 text-sm">
            <PanelRow label="Customers checked" value={summary.totalRecipientCount} />
            <PanelRow label="Eligible when queued" value={summary.eligibleCount} />
            <PanelRow label="Skipped before sending" value={summary.skippedBeforeSendCount} />
          </dl>
        </Panel>

        <Panel id="results-skipped-heading" title="Why customers were skipped">
          {skipped.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No customers were skipped.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {skipped.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>

        <Panel id="results-failures-heading" title="Why messages failed">
          {failures.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No messages have failed.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {failures.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
```

(`PanelRow` keeps label and value on one line with `justify-between`; long failure reasons wrap inside `dt`. If a long reason overflows at 375px, add `min-w-0 break-words` to the `dt` in `components/ui/panel.tsx`; this is covered by the overflow test in Task 6.)

- [ ] **Step 5: Append the e2e tests**

Append to `e2e/campaign-detail.spec.ts`:

```ts
const queued = campaign("k-3", "Weekend offer", { status: "QUEUED" });
const failedCampaign = campaign("k-5", "Autumn tasting", { status: "FAILED" });

test.describe("campaign detail: Audience and Results", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the Audience tab lists who will receive a draft and who is skipped, in plain words", async ({
    page,
  }) => {
    const mixed = [
      ...people,
      customer("c-3", "Alan", { email: "alan@bletchley.test", unsubscribedAt: "2026-09-01T00:00:00Z" }),
      customer("c-4", "Dee", { emailOptIn: true }),
    ];
    const state = await mockApi(page, {
      businesses: [bakery],
      customers: { b1: mixed },
      campaigns: { b1: [draft] },
    });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    await expect(page.getByText("This is who would receive the campaign right now.")).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Customers checked4");
    await expect(summary).toContainText("Will receive it2");
    await expect(summary).toContainText("Skipped2");

    const reasons = page.getByRole("region", { name: "Why customers were skipped" });
    await expect(reasons).toContainText("Hasn’t agreed to receive emails1");
    await expect(reasons).toContainText("No email address1");

    const recipients = page.getByRole("region", { name: "Recipients" });
    await expect(recipients).toContainText("ada@example.com");
    await expect(recipients).toContainText("grace@navy.test");
    await expect(page.getByRole("region", { name: "Skipped customers" })).toContainText(
      "Hasn’t agreed to receive emails",
    );

    // Viewing a draft never queues it.
    expect(state.requests.some((request) => request.path.endsWith("/queue"))).toBe(false);
    await expect(page.getByRole("button", { name: /Queue/ })).toHaveCount(0);
  });

  test("the Audience tab explains a saved recipient list for a sent campaign", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], customers: { b1: people }, campaigns: { b1: [sent] } });
    await page.goto("/businesses/b1/campaigns/k-4/preview");

    await expect(page.getByText("fixed when the campaign was queued")).toBeVisible();
  });

  test("Results for a draft says there is nothing yet and offers Review and send", async ({ page }) => {
    const state = await mockApi(page, { businesses: [bakery], campaigns: { b1: [draft] } });
    await page.goto("/businesses/b1/campaigns/k-1/analytics");

    await expect(page.getByRole("heading", { name: "No results yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review and send" }).last()).toHaveAttribute(
      "href",
      "/businesses/b1/campaigns/k-1/send",
    );
    expect(state.requests.some((request) => request.path.endsWith("/analytics"))).toBe(false);
  });

  test("Results shows delivery, recipients and the reasons for skips and failures", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      analytics: {
        "k-4": {
          eligibleCount: 4,
          sentCount: 2,
          failedDeliveryCount: 2,
          skippedBeforeSendCount: 1,
          skippedByReason: { "Customer has unsubscribed": 1 },
          failedByReason: { "Daily limit reached for this account": 2 },
        },
      },
    });
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    const delivery = page.getByRole("region", { name: "Delivery" });
    await expect(delivery).toContainText("Sent");
    await expect(delivery).toContainText("50% success rate");

    const recipients = page.getByRole("region", { name: "Recipients" });
    await expect(recipients).toContainText("Eligible when queued4");
    await expect(recipients).toContainText("Skipped before sending1");

    await expect(page.getByRole("region", { name: "Why customers were skipped" })).toContainText(
      "Hasn’t agreed to receive emails1",
    );
    await expect(page.getByRole("region", { name: "Why messages failed" })).toContainText(
      "Daily limit reached for this account2",
    );
    await expect(page.getByText(/Daily sending limits can mark some recipients as failed/)).toBeVisible();
  });

  test("Results for a queued campaign explains the wait, and Refresh reloads both the numbers and the status", async ({
    page,
  }) => {
    const state = await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [queued] },
      analytics: { "k-3": { eligibleCount: 3, pendingCount: 3 } },
    });
    await page.goto("/businesses/b1/campaigns/k-3/analytics");

    await expect(page.getByText(/queued and waiting to be sent/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Queued");

    // The worker finishes while the page is open.
    state.campaigns.b1[0].status = "SENT";
    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(page.getByRole("region", { name: "Campaign summary" })).toContainText("Sent");
    await expect(page.getByText(/queued and waiting to be sent/)).toHaveCount(0);
  });

  test("Results explains an older campaign without a saved recipient list, and an empty delivery", async ({
    page,
  }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [failedCampaign] },
      analytics: { "k-5": { analyticsSource: "LEGACY_LOGS" } },
    });
    await page.goto("/businesses/b1/campaigns/k-5/analytics");

    await expect(page.getByText(/older campaign without a saved recipient list/)).toBeVisible();
    await expect(page.getByText("No messages have gone out yet.")).toBeVisible();
    await expect(page.getByText("No messages have failed.")).toBeVisible();
    await expect(page.getByText("No customers were skipped.")).toBeVisible();
  });

  test("a failed results request offers a retry", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] }, failAnalyticsFor: ["k-4"] });
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    await expect(page.getByRole("heading", { name: "Couldn’t load the results" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
```

If `getByRole("region", { name: "Summary" })` is ambiguous with "Campaign summary" (substring), use `{ name: "Summary", exact: true }`; the same for "Recipients" and "Delivery". Never weaken the assertions.

- [ ] **Step 6: Run everything**

Run: `npx tsc --noEmit -p apps/web` then `npm run lint -w apps/web`; `npx vitest run apps/web`; `npx playwright test e2e/campaign-detail.spec.ts` then `git checkout -- playwright-report test-results`; then the full `npx playwright test` and restore.
Expected: all pass (87 + 7 + 7 = 101, give or take the number of tests you actually wrote).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): rebuild the Audience and Results tabs with the design system

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Delivery log tab and link re-pointing

**Files:**
- Modify (full rewrite): `.../(detail)/logs/page.tsx`
- Modify: `apps/web/src/lib/dashboard.ts` (`campaignHref`), `apps/web/src/lib/dashboard.test.ts`, `e2e/helpers/app.ts` (logs), `e2e/campaign-detail.spec.ts` (append), `e2e/dashboard.spec.ts`, `e2e/campaigns.spec.ts` (draft link expectations)

**Interfaces:**
- Consumes: Task 1 (`logStatusMeta`, `sendLimitNotes`, `Badge`), Task 2 (`useCampaign`), `formatDateTime`, `Table` primitives, `useApi`, `MessageLog`.
- Produces: the Delivery log tab; mock option `logs: Record<campaignId, MockLog[]>` and `MockLog`/`log()` factory; `campaignHref` re-pointed.

- [ ] **Step 1: Mock logs**

In `e2e/helpers/app.ts` add:

```ts
export type MockLog = {
  id: string;
  ownerId: string;
  businessId: string;
  campaignId: string;
  customerId: string | null;
  channel: "EMAIL" | "SMS";
  recipient: string;
  status: "PENDING" | "SENT" | "FAILED";
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function log(
  id: string,
  campaignId: string,
  recipient: string,
  overrides: Partial<MockLog> = {},
  businessId = "b1",
): MockLog {
  return {
    id,
    ownerId: "user-1",
    businessId,
    campaignId,
    customerId: null,
    channel: "EMAIL",
    recipient,
    status: "SENT",
    errorMessage: null,
    sentAt: "2026-09-20T12:00:05.000Z",
    createdAt: "2026-09-20T12:00:00.000Z",
    updatedAt: "2026-09-20T12:00:05.000Z",
    ...overrides,
  };
}
```

Add to `ApiMockOptions`: `/** Message logs per campaign id. */ logs?: Record<string, MockLog[]>;` and in the campaign route handler, before the final fall-through, add:

```ts
      if (campaignId && action === "logs" && request.method() === "GET") {
        return target
          ? json(200, options.logs?.[campaignId] ?? [])
          : json(404, { error: "Campaign not found" });
      }
```

- [ ] **Step 2: The Delivery log tab**

Replace `.../(detail)/logs/page.tsx` entirely with:

```tsx
"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { logStatusMeta, sendLimitNotes } from "@/lib/campaignDetail";
import { pluralize } from "@/lib/format";
import { formatDateTime } from "@/lib/schedule";
import type { MessageLog } from "@/lib/types";
import { useApi } from "@/lib/useApi";

function LogStatus({ status }: { status: MessageLog["status"] }) {
  const meta = logStatusMeta(status);
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

function sentAtLabel(log: MessageLog): string {
  return log.sentAt ? formatDateTime(log.sentAt) : "Not sent";
}

export default function CampaignDeliveryLogPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { data, error, slow, refetch } = useApi<MessageLog[]>(
    `/api/businesses/${businessId}/campaigns/${campaignId}/logs`,
  );

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the delivery log" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const failed = data.filter((log) => log.status === "FAILED").length;

  return (
    <div className="space-y-4">
      <Panel id="log-limits-heading" title="Why a message can fail">
        <p className="mt-2 text-sm text-muted">
          Each failed message below explains what went wrong. Daily sending limits are a common
          reason:
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {sendLimitNotes().map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Panel>

      {data.length === 0 ? (
        <EmptyState
          icon="send"
          title="No messages yet"
          description="Messages appear here once the campaign starts sending."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {pluralize(data.length, "message")}
            {failed > 0 ? `, ${failed} failed` : ""}
          </p>

          <div className="hidden lg:block">
            <Table caption="Delivery log" fixed>
              <THead>
                <tr>
                  <Th className="w-[30%]">Recipient</Th>
                  <Th className="w-32">Status</Th>
                  <Th className="w-48">Sent</Th>
                  <Th>Details</Th>
                </tr>
              </THead>
              <TBody>
                {data.map((log) => (
                  <Tr key={log.id}>
                    <Td className="overflow-hidden">
                      <div className="truncate font-medium text-ink" title={log.recipient}>
                        {log.recipient}
                      </div>
                    </Td>
                    <Td>
                      <LogStatus status={log.status} />
                    </Td>
                    <Td className="text-muted">{sentAtLabel(log)}</Td>
                    <Td className="break-words text-muted">{log.errorMessage || "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="space-y-2 lg:hidden" aria-label="Delivery log">
            {data.map((log) => (
              <li key={log.id} className="rounded-container border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-ink">{log.recipient}</p>
                  <LogStatus status={log.status} />
                </div>
                <p className="mt-1 text-[13px] text-muted">{sentAtLabel(log)}</p>
                {log.errorMessage ? (
                  <p className="mt-1 break-words text-[13px] text-ink">{log.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Re-point `campaignHref`**

In `apps/web/src/lib/dashboard.ts` replace `campaignHref` with:

```ts
/**
 * Where a campaign link goes: drafts open on the Audience tab (sending always goes through
 * the wizard's confirm step); everything else opens on the Results tab.
 */
export function campaignHref(
  businessId: string,
  campaign: Pick<DashboardCampaign, "id" | "status">,
): string {
  const section = campaign.status === "DRAFT" ? "preview" : "analytics";
  return `/businesses/${businessId}/campaigns/${campaign.id}/${section}`;
}
```

(The `channel` parameter that Phase 4 added is no longer needed: no draft link bypasses a confirmation any more. Drop it from the signature and from the callers `campaign-table.tsx` and `recent-campaigns.tsx` if they pass it.)

Update `apps/web/src/lib/dashboard.test.ts` so the draft case expects `/preview` for both email and SMS drafts and `/analytics` for the others (replace the Phase 4 SMS-draft test accordingly). Update the e2e expectations: in `e2e/campaigns.spec.ts` the email draft row link now expects `/businesses/b1/campaigns/k-1/preview`; in `e2e/dashboard.spec.ts` (the recent campaigns test, around line 157) the draft link expects `/preview` again.

- [ ] **Step 4: Append the e2e tests**

Append to `e2e/campaign-detail.spec.ts` (add `log` to the helper import):

```ts
test.describe("campaign detail: Delivery log", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("lists every message with its status, send time and failure reason", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: {
        "k-4": [
          log("l-1", "k-4", "ada@example.com"),
          log("l-2", "k-4", "grace@navy.test", {
            status: "FAILED",
            sentAt: null,
            errorMessage: "Daily limit reached for this account",
          }),
          log("l-3", "k-4", "alan@bletchley.test", { status: "PENDING", sentAt: null }),
        ],
      },
    });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByText("3 messages, 1 failed")).toBeVisible();
    await expect(page.getByRole("row", { name: /ada@example.com/ })).toContainText("Sent");
    const failedRow = page.getByRole("row", { name: /grace@navy.test/ });
    await expect(failedRow).toContainText("Failed");
    await expect(failedRow).toContainText("Not sent");
    await expect(failedRow).toContainText("Daily limit reached for this account");
    await expect(page.getByRole("row", { name: /alan@bletchley.test/ })).toContainText("Pending");
  });

  test("explains the sending limits that can cause a failure", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] }, logs: { "k-4": [] } });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    const limits = page.getByRole("region", { name: "Why a message can fail" });
    await expect(limits).toContainText("one campaign email every 24 hours");
    await expect(limits).toContainText("up to 25 campaign emails");
    await expect(limits).toContainText("up to 100 campaign emails");
  });

  test("shows an empty state when nothing has been delivered yet", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [queued] }, logs: { "k-3": [] } });
    await page.goto("/businesses/b1/campaigns/k-3/logs");

    await expect(page.getByRole("heading", { name: "No messages yet" })).toBeVisible();
  });

  test("uses stacked cards on narrower screens", async ({ page }) => {
    await mockApi(page, {
      businesses: [bakery],
      campaigns: { b1: [sent] },
      logs: {
        "k-4": [
          log("l-2", "k-4", "grace@navy.test", {
            status: "FAILED",
            sentAt: null,
            errorMessage: "Daily limit reached for this account",
          }),
        ],
      },
    });
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByRole("table")).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "grace@navy.test" });
    await expect(card).toContainText("Failed");
    await expect(card).toContainText("Daily limit reached for this account");
  });

  test("a failed request offers a retry", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [sent] } });
    await page.route("**/api/businesses/b1/campaigns/k-4/logs", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*" },
            body: JSON.stringify({ error: "Logs unavailable" }),
          })
        : route.fallback(),
    );
    await page.goto("/businesses/b1/campaigns/k-4/logs");

    await expect(page.getByRole("heading", { name: "Couldn’t load the delivery log" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
```

- [ ] **Step 5: Run everything**

Run: `npx tsc --noEmit -p apps/web`, `npm run lint -w apps/web`, `npx vitest run apps/web`, `npx playwright test e2e/campaign-detail.spec.ts e2e/campaigns.spec.ts e2e/dashboard.spec.ts` then the full `npx playwright test`; restore the tracked report folders each time.
Expected: all pass. Also `grep -rn "campaigns/\${[a-zA-Z.]*}/\(preview\|analytics\|logs\)" apps/web/src` should show no remaining hand-built links to the old pages other than `campaignHref` and `detailHref`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): rebuild the Delivery log tab and send draft links to the Audience tab

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Account page, sidebar entry and the wizard's Account link

**Files:**
- Create: `apps/web/src/components/shell/use-logout.ts`, `apps/web/src/app/(app)/account/page.tsx`, `e2e/account.spec.ts`
- Modify: `apps/web/src/components/shell/sidebar.tsx`, `apps/web/src/lib/campaignWizard.ts` (+ `campaignWizard.test.ts`), `apps/web/src/components/campaigns/wizard/step-review.tsx`, `e2e/helpers/app.ts` (Supabase auth mock), `e2e/campaign-wizard.spec.ts`, `e2e/shell.spec.ts` (only if a nav-list assertion needs the new entry)

**Interfaces:**
- Consumes: Task 1 (`validatePasswordForm`, `passwordErrorTarget`, `authErrorMessage`, `Panel`), `supabase`, `toSessionUser`, `useSession`, `TextField`, `Button`, `Badge`, `FormError`, `useToast`, `focusFirstInvalid`.
- Produces: `useLogout(): () => Promise<void>`; the `/account` route; `SendBlock` gains `action?: { label: string; href: string }` (set for `email-unconfirmed`); mock options `authErrors?: { updateUser?: string }`, `confirmedAfterRefresh?: boolean`, and `state.authRequests`.

- [ ] **Step 1: Extract the log-out action**

Create `apps/web/src/components/shell/use-logout.ts`:

```ts
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

/** Signs out everywhere if possible, and always on this device, then returns to the login page. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();

  return useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
    }
    router.replace("/login");
  }, [router]);
}
```

In `apps/web/src/components/shell/sidebar.tsx` replace the inline `handleLogout` (and the now-unused `useRouter`/`supabase` imports) with `const handleLogout = useLogout();`, import `useLogout` from `./use-logout`, and add an Account group below the business group inside the `<nav>`:

```tsx
        <NavGroup
          heading="Account"
          entries={[{ href: "/account", label: "Account", icon: "user", exact: true }]}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
```

- [ ] **Step 2: The Account page**

Create `apps/web/src/app/(app)/account/page.tsx`:

```tsx
"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLogout } from "@/components/shell/use-logout";
import { useSession } from "@/components/shell/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { authErrorMessage, passwordErrorTarget, validatePasswordForm } from "@/lib/account";
import { focusFirstInvalid } from "@/lib/forms";
import { toSessionUser } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Account" }]}
        title="Account"
        description="Your sign-in details and session."
      />
      <div className="max-w-2xl space-y-4">
        <SignInPanel />
        <PasswordPanel />
        <SessionPanel />
      </div>
    </PageContainer>
  );
}

function SignInPanel() {
  const user = useSession();
  const toast = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (!user.email || resending) {
      return;
    }
    setResending(true);
    setMessage(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
    setResending(false);
    if (error) {
      setMessage(authErrorMessage(error, "Could not send the confirmation email. Try again."));
      return;
    }
    toast.success("Confirmation email sent");
  }

  async function recheck() {
    if (checking) {
      return;
    }
    setChecking(true);
    setMessage(null);
    // A fresh session carries the current confirmation state; SessionProvider picks it up.
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);
    if (error || !data.session) {
      setMessage(authErrorMessage(error, "Could not check your email status. Try again."));
      return;
    }
    if (toSessionUser(data.session.user).emailConfirmed) {
      toast.success("Email confirmed");
    } else {
      setMessage("Your email isn’t confirmed yet. Open the link in the confirmation email first.");
    }
  }

  return (
    <Panel id="account-signin-heading" title="Sign-in">
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="break-words font-medium text-ink">{user.email ?? "Signed in"}</dd>
        </div>
        <div>
          <dt className="text-muted">Email status</dt>
          <dd className="mt-1">
            {user.emailConfirmed ? (
              <Badge tone="success" icon="check">
                Email confirmed
              </Badge>
            ) : (
              <Badge tone="warning" icon="alert">
                Email not confirmed
              </Badge>
            )}
          </dd>
        </div>
      </dl>

      {user.emailConfirmed ? null : (
        <div className="mt-4 space-y-3">
          <p className="max-w-prose text-sm text-muted">
            Campaigns can only be sent from accounts with a confirmed email address. Open the link
            in the confirmation email, or send it again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={resend} loading={resending}>
              <Icon name="send" />
              Resend confirmation email
            </Button>
            <Button onClick={recheck} loading={checking}>
              I’ve confirmed it
            </Button>
          </div>
          {message ? <FormError message={message} /> : null}
        </div>
      )}
    </Panel>
  );
}

function PasswordPanel() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setFormError(null);

    const clientErrors = validatePasswordForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSaving(false);

    if (error) {
      const text = authErrorMessage(error, "Could not change the password. Try again.");
      if (passwordErrorTarget(text) === "password") {
        setErrors({ password: text });
        focusFirstInvalid(formRef.current);
      } else {
        setFormError(text);
      }
      return;
    }

    setValues({ password: "", confirm: "" });
    toast.success("Password changed");
  }

  return (
    <Panel id="account-password-heading" title="Password">
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-3 max-w-sm space-y-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={values.password}
          onChange={(event) => setValues((previous) => ({ ...previous, password: event.target.value }))}
          error={errors.password}
        />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirm}
          onChange={(event) => setValues((previous) => ({ ...previous, confirm: event.target.value }))}
          error={errors.confirm}
        />
        {formError ? <FormError message={formError} /> : null}
        <Button type="submit" variant="primary" loading={saving}>
          Change password
        </Button>
      </form>
    </Panel>
  );
}

function SessionPanel() {
  const logout = useLogout();
  const [busy, setBusy] = useState(false);

  return (
    <Panel id="account-session-heading" title="Session">
      <p className="mt-2 max-w-prose text-sm text-muted">
        Log out of DireConnect on this device.
      </p>
      <Button
        className="mt-4"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          await logout();
        }}
      >
        <Icon name="logout" />
        Log out
      </Button>
    </Panel>
  );
}
```

- [ ] **Step 3: The wizard's Account link**

In `apps/web/src/lib/campaignWizard.ts` add `action` to `SendBlock` and set it for the email block, and update that block's copy:

```ts
export type SendBlock = {
  code: "no-recipients" | "over-limit" | "email-unconfirmed";
  title: string;
  message: string;
  /** A place to go to fix the problem, when there is one. */
  action?: { label: string; href: string };
};
```

```ts
  if (!emailConfirmed) {
    blocks.push({
      code: "email-unconfirmed",
      title: "Confirm your email address first",
      message:
        "Campaigns can only be sent from accounts with a confirmed email address. Open your Account page to resend the confirmation email or check the status, then come back to this draft.",
      action: { label: "Open Account", href: "/account" },
    });
  }
```

Add to the `sendBlocks` unit tests: the unconfirmed block has `action` `{ label: "Open Account", href: "/account" }` and the other two blocks have none.

In `apps/web/src/components/campaigns/wizard/step-review.tsx` render the action beside the block's text, using `Link` and `buttonClasses`:

```tsx
            {block.action ? (
              <Link
                href={block.action.href}
                className={buttonClasses({ variant: "secondary", className: "mt-2" })}
              >
                {block.action.label}
              </Link>
            ) : null}
```

(import `Link` from `next/link` and `buttonClasses` from `@/components/ui/button`.) Update the Phase 4 e2e test "blocks sending until the account email is confirmed" to also assert the `Open Account` link (`href="/account"`) and the new wording.

- [ ] **Step 4: Mock Supabase auth**

In `e2e/helpers/app.ts`:

1. Add options:

```ts
  /** Makes Supabase auth calls fail: `updateUser` answers 422 with this message. */
  authErrors?: { updateUser?: string };
  /** When true, a refreshed session reports the email as confirmed. */
  confirmedAfterRefresh?: boolean;
```

2. Add `authRequests: [] as RecordedRequest[]` to `state`.
3. Replace the existing catch-all Supabase route

```ts
  await page.route("https://example.supabase.co/**", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
  );
```

with:

```ts
  await page.route("https://example.supabase.co/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    };
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }

    const rawBody = request.postData();
    state.authRequests.push({
      method: request.method(),
      path: url.pathname,
      body: rawBody ? JSON.parse(rawBody) : undefined,
    });

    const user = (confirmed: boolean) => ({
      id: "user-1",
      aud: "authenticated",
      email: "owner@example.com",
      ...(confirmed ? { email_confirmed_at: "2026-01-01T00:00:00Z" } : {}),
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    });

    if (url.pathname === "/auth/v1/user" && request.method() === "PUT") {
      if (options.authErrors?.updateUser) {
        return json(422, { code: 422, error_code: "weak_password", msg: options.authErrors.updateUser });
      }
      return json(200, user(true));
    }
    if (url.pathname === "/auth/v1/resend" && request.method() === "POST") {
      return json(200, {});
    }
    if (url.pathname === "/auth/v1/token" && request.method() === "POST") {
      return json(200, {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 86_400,
        expires_at: Math.floor(Date.now() / 1000) + 86_400,
        user: user(Boolean(options.confirmedAfterRefresh)),
      });
    }
    if (url.pathname === "/auth/v1/logout") {
      return route.fulfill({ status: 204, headers: cors });
    }
    return json(404, {});
  });
```

(The `state` object must exist before this route is registered: move the `state` declaration above it, or register the route after `state` is created.) Return `state` as before.

- [ ] **Step 5: Write the e2e tests**

Create `e2e/account.spec.ts`:

```ts
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
    await expect(page.getByLabel("New password")).toBeFocused();

    await page.getByLabel("New password").fill("one-password");
    await page.getByLabel("Repeat new password").fill("another-one");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("The passwords don’t match.")).toBeVisible();

    expect(state.authRequests.some((request) => request.path === "/auth/v1/user")).toBe(false);
  });

  test("changes the password and clears the fields", async ({ page }) => {
    await signIn(page);
    const state = await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await page.getByLabel("New password").fill("a-better-password");
    await page.getByLabel("Repeat new password").fill("a-better-password");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByText("Password changed")).toBeVisible();
    await expect(page.getByLabel("New password")).toHaveValue("");
    await expect(page.getByLabel("Repeat new password")).toHaveValue("");

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

    await page.getByLabel("New password").fill("abc");
    await page.getByLabel("Repeat new password").fill("abc");
    await page.getByRole("button", { name: "Change password" }).click();

    await expect(page.getByText("Password should be at least 6 characters.")).toBeVisible();
    await expect(page.getByLabel("New password")).toBeFocused();
    await expect(page.getByLabel("New password")).toHaveValue("abc");
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
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/account");

    await page.getByRole("region", { name: "Session" }).getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
```

Add to `e2e/campaign-wizard.spec.ts`: in the unconfirmed-email test, assert `page.getByRole("link", { name: "Open Account" })` has `href` `/account`.

If the unconfirmed-session test's refreshed session does not reach `SessionProvider` (the status badge stays "not confirmed"), check that `onAuthStateChange` fires for `refreshSession` in this supabase-js version and, if it only fires `TOKEN_REFRESHED` with the old object, call `supabase.auth.getSession()` after the refresh or update the provider; fix the cause, never the assertion.

- [ ] **Step 6: Run everything**

Run: `npx tsc --noEmit -p apps/web`, `npm run lint -w apps/web`, `npx vitest run apps/web`, `npx playwright test e2e/account.spec.ts e2e/campaign-wizard.spec.ts e2e/shell.spec.ts`, then the full `npx playwright test`; restore the tracked report folders.
Expected: all pass. If a shell test counted navigation items or sidebar links, update the count for the new Account entry (explain in the report).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): add the Account page, a sidebar entry, and an Account link in the send checks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Document and verify the whole phase

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`
- Create: `e2e/detail-accessibility.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the finished phase.

- [ ] **Step 1: Keyboard, focus and small-screen tests**

Create `e2e/detail-accessibility.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { business, campaign, customer, log, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const LONG = "A-campaign-name-without-any-spaces-that-is-much-longer-than-a-phone-screen-is-wide";

const sent = campaign("k-4", LONG, {
  status: "SENT",
  sendAt: "2026-09-20T12:00:00.000Z",
  message: `${LONG}${LONG}`,
});

const mocks = {
  businesses: [bakery],
  customers: {
    b1: [customer("c-1", "Ada", { email: "ada-with-a-very-long-address-that-keeps-going@example.com", emailOptIn: true })],
  },
  campaigns: { b1: [sent] },
  analytics: {
    "k-4": {
      eligibleCount: 4,
      sentCount: 2,
      failedDeliveryCount: 2,
      skippedBeforeSendCount: 1,
      skippedByReason: { "Customer has unsubscribed": 1 },
      failedByReason: { "Daily limit reached for this account and this is an unbroken-reason-string-that-is-very-long": 2 },
    },
  },
  logs: {
    "k-4": [
      log("l-1", "k-4", "ada-with-a-very-long-address-that-keeps-going@example.com", {
        status: "FAILED",
        sentAt: null,
        errorMessage: "Daily limit reached for this account and this is an unbroken-reason-string-that-is-very-long",
      }),
    ],
  },
};

test.describe("campaign detail and account: keyboard and small screens", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the tabs are reachable and operable with the keyboard", async ({ page }) => {
    await mockApi(page, mocks);
    await page.goto("/businesses/b1/campaigns/k-4/analytics");

    const tabs = page.getByRole("navigation", { name: "Campaign sections" });
    await tabs.getByRole("link", { name: "Audience" }).focus();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Results" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/campaigns\/k-4\/logs$/);
    await expect(tabs.getByRole("link", { name: "Delivery log" })).toHaveAttribute("aria-current", "page");
  });

  test("deleting a draft can be done from the keyboard and Escape returns focus", async ({ page }) => {
    await mockApi(page, { businesses: [bakery], campaigns: { b1: [campaign("k-1", "Spring menu")] } });
    await page.goto("/businesses/b1/campaigns/k-1/preview");

    const remove = page.getByRole("button", { name: "Delete" });
    await remove.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Delete “Spring menu”?" });
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(remove).toBeFocused();
  });

  for (const tab of ["preview", "analytics", "logs"]) {
    test(`the ${tab} tab does not scroll sideways at 375px`, async ({ page }) => {
      await mockApi(page, mocks);
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/businesses/b1/campaigns/k-4/${tab}`);

      // Wait for real content, not just the header.
      const marker = {
        preview: "Customers checked",
        analytics: "Eligible when queued",
        logs: "Why a message can fail",
      }[tab]!;
      await expect(page.getByText(marker).first()).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("the account page does not scroll sideways at 375px and its form is keyboard operable", async ({
    page,
  }) => {
    await mockApi(page, mocks);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 2, name: "Password" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByLabel("New password").focus();
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Tab");
    await page.keyboard.type("a-better-password");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Password changed")).toBeVisible();
  });
});
```

If a tab overflows at 375px, fix the component (`min-w-0`, `break-words`, or `[grid-template-columns:minmax(0,1fr)]` on grids; for `PanelRow` add `min-w-0 break-words` to the `dt`), then re-run; never loosen the assertion.

- [ ] **Step 2: Update the spec in place**

Edit `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`:

- Rewrite the **Campaign detail** paragraph of section 7 in place (no appended corrections) to describe the build exactly: the route-group layout; the header (breadcrumbs, title as the page's `<h1>`, status badge, channel, When text, SMS-paused note, the message clamped to three lines); the draft-only actions (Review and send opens the wizard on its Review step, Edit opens it on the first step, Delete asks for confirmation then returns to the list; SMS drafts and non-drafts show fewer or none); the three tabs as route links with `aria-current`; the index address redirecting to Audience for drafts and Results otherwise; Audience (read-only, intro text by status, summary and merged plain-language skip reasons, paged Recipients and Skipped customers lists, no queue button); Results (notes, refresh, Delivery bar reused from the dashboard, recipient counts, skipped reasons, failure reasons in the worker's wording, the empty states for drafts and the legacy-snapshot notice); Delivery log (limits explanation, count line, table from `lg`, cards below, status badges with icons, send time or "Not sent", failure reason).
- Update section 5.1: the detail layout lives in `[campaignId]/(detail)/layout.tsx` with `page.tsx`, `preview`, `analytics`, `logs`; `edit` and a new `send` route sit outside the group.
- Rewrite the **Account** paragraph of section 7 in place: Sign-in (email, confirmation status badge, resend and re-check buttons while unconfirmed), Password (new and repeat; client checks; server refusals beside the field), Session (log out).
- In the **Campaign wizard** paragraph, change the unconfirmed-email block text to say it links to the Account page.
- In section 6, state that the sidebar's Account group links to `/account`.
- In section 10 leave the phase list as is.

- [ ] **Step 3: Full verification**

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

Expected: tsc exit 0; lint 0 errors; vitest all pass; `npm test` has exactly one failing file (`apps/api/src/routes/campaign.test.ts`, the known baseline); the web build succeeds and lists `/account`, the three tab routes, `/campaigns/[campaignId]` and `/campaigns/[campaignId]/send`; Playwright all pass; `git status` shows only intended files. Also run `grep -rn "min-h-screen bg-gray" apps/web/src` and confirm no legacy dark page remains.

- [ ] **Step 4: Visual pass**

Authenticated screens cannot be viewed without a real Supabase and API; say so in the report and state that they were verified through the mocked e2e only. If a real backend is available locally, open the three tabs for a draft, a queued and a sent campaign, and the Account page, at 375, 768 and 1280px in light and dark, and note anything off.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src e2e docs/superpowers/specs
git commit -m "docs(web): document the campaign detail and Account pages; test keyboard and 375px

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (sections 5.1, 6, 7 "Campaign detail" and "Account", 8, 9):**
- Shared detail layout with title, status, channel, message and draft-only actions (Edit, Delete, Send): Task 2; tabs linking to the existing routes: Tasks 1 and 2; the index redirect (Results, or Audience for drafts): Task 2.
- Audience, Results and Delivery log restyled with shared components, the failure reason in plain text and a legend explaining the limits, draft-only actions hidden for SMS campaigns: Tasks 2 to 4.
- Account sections (sign-in email read-only, password change via `supabase.auth.updateUser`, session log out) and the sidebar's Account group: Task 5; the wizard's Account link that Phase 4 deferred: Task 5.
- Re-pointing of the dashboard's recent-campaign links and the list's row links: Task 4 (`campaignHref`).
- Accessibility (keyboard, focus, no colour-only status, 40px targets, no horizontal scroll) and tests (pure logic in Node, behaviour in Playwright with mocks): Tasks 1 to 6.
- Spec deviations (route group, `send` route, link tabs instead of a tablist, read-only Audience, moved `Panel`) are listed above and written back into the spec in Task 6.

**Placeholder scan:** none; every code step has complete code. The few conditional notes (locator collisions, supabase event behaviour, 375px fixes) describe what to do if a named, specific failure appears.

**Type consistency:** `MessageLog`, `DetailSegment`, `SendBlock.action`, `RecipientItem`, `useCampaign()`, `CampaignProvider`, `LinkTabs` items, and the mock options (`analytics` extras, `logs`, `authErrors`, `confirmedAfterRefresh`, `state.authRequests`) are each defined once and used by those names later. `campaignHref` goes back to its original two-field signature (Task 4 removes the `channel` field Phase 4 added, along with its callers' argument).
