# DireConnect UI Redesign, Phase 6: Account Hardening, Page Titles and Campaign Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gaps the Phase 5 final review and the five-phase wrap-up listed: password recovery and a safer password change, a distinct title for every page, buttons that keep keyboard focus while loading, campaign Results/Delivery log that refresh themselves while a campaign is being delivered, a visible reason on failed campaigns, and honest messaging about the 10-recipient launch limit.

**Architecture:** Small, independent changes to shared UI (`PageHeader`, `AuthCard`, `Button`), two campaign tabs, the Account page, and two new auth pages. Logic that can be pure lives in `src/lib` with Node unit tests; behaviour is covered by Playwright with the existing mocked Supabase and API. No backend changes.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, `@supabase/supabase-js` (installed), Vitest (node), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (sections 6, 7 "Auth pages", "Campaign detail", "Account", 8, 9). Phases 1 to 5 are merged on `main`; this plan builds on their exact APIs.

## Global Constraints

Carried verbatim from Phases 1 to 5:

- Scope is `apps/web`, `e2e/`, and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts. No new dependencies. **The 10-recipient campaign cap stays as it is (owner decision): only the messaging changes.**
- Light theme by default; dark follows `prefers-color-scheme`. Colours come only from the token utilities (`bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `text-accent-ink`, `bg-accent-soft`, `bg-success`/`text-success`/`bg-success-soft`, `bg-warning`/`text-warning`/`bg-warning-soft`, `bg-danger`/`text-danger`/`bg-danger-soft`, `rounded-control` = 6px, `rounded-container` = 10px, `shadow-float`). No raw `gray-`/`blue-`/`green-`/`red-` classes.
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Touch targets: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths; icon-only buttons `min-h-10 min-w-10`; text links used as controls get `min-h-10` (or are rendered with `buttonClasses`).
- Meaning is never conveyed by colour alone: every status carries an icon and a text label.
- Motion only in response to a user action. Loading indicators are exempt.
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- Copy: active voice, sentence case, the same verb for button and toast where truthful. Errors state what happened and how to fix it; no apologies.
- **Modal convention:** inside a dialog, errors are shown inline; a toast is fired as/after the dialog closes. A dialog with a request in flight is not dismissible.
- `useApi` returns `{ data, error, loading, slow, refetch }` (state scoped to the path; old data kept while the same path refetches). `apiFetch<T>(path, { method?, body?, signal? })`. `useSession()` returns `{ id, email, emailConfirmed }`. `useToast()` returns `{ success, error }`. `useCampaign()` (campaign detail layout) returns `{ campaign, refetch, refreshing, refreshError }`.
- Work on branch `ui-redesign-phase-6`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` verbatim (whichever model you are).
- Playwright runs modify the TRACKED `playwright-report/` and `test-results/`; restore them after each run (`git checkout -- playwright-report test-results`; also `git clean -fdq playwright-report test-results` for untracked leftovers) and never commit them.
- `apps/api/src/routes/campaign.test.ts` already fails on `main` because of a stale git-ignored `apps/api/src/config/env.js`; never touch that file. Expect exactly that one failing file in `npm test`.
- In Playwright prefer role-based locators (`getByRole("textbox", { name, exact: true })`, `getByRole("radio", ...)`); `getByLabel("New password")` also matches "Repeat new password"; step/section landmarks are labelled regions that can collide with `getByLabel`.
- Focus after async validation must be effect-driven, not `requestAnimationFrame`-driven (Phase 5 fixed a race this way in the wizard and the Account page).
- `apps/web/AGENTS.md` warns this Next.js version differs from older ones; use only patterns already used by existing pages (client pages, `useParams`, `useRouter`, `Link`, route groups). Do not introduce `useSearchParams` (it needs a Suspense boundary) or other new Next.js APIs.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

## Review Focus

1. **Password change must prove the current password and must not lock the user out.** A wrong current password never reaches `updateUser`; after a successful change other devices are signed out but this one stays signed in; an error from signing out the others must not be reported as a failed password change. (Task 3)
2. **Password recovery must not reveal whether an email has an account.** The "forgot password" page always shows the same confirmation, whatever Supabase answers (except genuine rate-limit/network errors). An expired or reused reset link, or a direct visit to `/reset-password`, explains itself and links to `/forgot-password`. (Task 4)
3. **Loading buttons must never double-submit.** Changing `Button` from `disabled` to `aria-disabled` while loading must still block clicks, Enter-key implicit submission and repeated activation. (Task 1)
4. **Auto-refresh must stop.** Polling runs only while a campaign is queued and the tab is visible, stops when the status changes or the page unmounts, and never stacks requests. (Task 2)
5. **Honest limit messaging.** Over the 10-recipient cap the UI must not nudge users to edit consent to fit; it says the limit is a launch limit and larger campaigns are not available yet. (Task 2)

## Decisions already made

- Recipient cap: **keep 10**, explain better (owner choice).
- Email confirmation: nothing to build. The "unconfirmed email" UI is correct whichever way the Supabase "Confirm email" setting is; the final report tells the owner how to check it.
- Password change requires the current password, verified with `signInWithPassword` (Supabase's `updateUser` does not check it). That call replaces the local session with an equivalent one for the same user; `SessionProvider` is keyed by user id so nothing remounts.
- After a password change, `signOut({ scope: "others" })` ends the user's other sessions.
- Forgot-password uses `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`. **The owner must add `<site origin>/reset-password` to Supabase Authentication > URL Configuration > Redirect URLs** (the final report says so).

## File structure

New (under `apps/web/src`):

| File | Responsibility |
|---|---|
| `lib/pageTitle.ts` (+ test) | `pageTitle(title)` formatter |
| `lib/useAutoRefresh.ts` (+ test for the pure helper) | Poll `refetch` while active and visible |
| `components/campaigns/detail/refresh-bar.tsx` | Shared Refresh button, "Refreshing…" status and "couldn’t refresh" notice for the Results and Delivery log tabs |
| `app/(auth)/forgot-password/page.tsx` | Request a reset email |
| `app/(auth)/reset-password/page.tsx` | Choose a new password from the emailed link |
| `e2e/page-titles.spec.ts`, `e2e/password-recovery.spec.ts` | Behaviour tests |

Modified: `components/ui/page-header.tsx`, `components/auth/auth-card.tsx`, `components/ui/button.tsx`, `lib/account.ts` (+ test), `app/(app)/account/page.tsx`, `app/(auth)/login/page.tsx`, the Results and Delivery log tabs and the detail layout/context, `lib/campaignDetail.ts` (+ test), `lib/campaignWizard.ts` (+ test), `components/campaigns/wizard/step-recipients.tsx`, `e2e/helpers/app.ts`, existing e2e specs touched by the changes, the spec.

---

### Task 1: Page titles and buttons that keep focus

**Files:**
- Create: `apps/web/src/lib/pageTitle.ts`, `apps/web/src/lib/pageTitle.test.ts`, `e2e/page-titles.spec.ts`
- Modify: `apps/web/src/components/ui/page-header.tsx`, `apps/web/src/components/auth/auth-card.tsx`, `apps/web/src/components/ui/button.tsx`, e2e specs that assert a loading button is `disabled`

**Interfaces:**
- Produces: `pageTitle(title: string): string` returning `"<title> · DireConnect"` (or `"DireConnect"` for a blank title); `PageHeader` and `AuthCard` set `document.title` from their `title`; `Button` with `loading` is `aria-disabled="true"` + `aria-busy="true"` (not `disabled`) and ignores clicks.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git checkout -b ui-redesign-phase-6
```

- [ ] **Step 2: Failing unit test**

Create `apps/web/src/lib/pageTitle.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("appends the product name", () => {
    expect(pageTitle("Customers")).toBe("Customers · DireConnect");
  });

  it("trims and falls back to the product name for a blank title", () => {
    expect(pageTitle("  Dashboard  ")).toBe("Dashboard · DireConnect");
    expect(pageTitle("")).toBe("DireConnect");
    expect(pageTitle("   ")).toBe("DireConnect");
  });
});
```

Run `npx vitest run apps/web/src/lib/pageTitle.test.ts`: FAIL (module missing).

- [ ] **Step 3: Implement the title**

Create `apps/web/src/lib/pageTitle.ts`:

```ts
const PRODUCT = "DireConnect";

/** The browser title for a page: "<page> · DireConnect". */
export function pageTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed ? `${trimmed} · ${PRODUCT}` : PRODUCT;
}
```

In `apps/web/src/components/ui/page-header.tsx` add `"use client";` as the first line, import `useEffect` from `react` and `pageTitle` from `@/lib/pageTitle`, and inside `PageHeader` add before the return:

```tsx
  // Client pages cannot export metadata, so each page names itself (WCAG 2.4.2).
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);
```

In `apps/web/src/components/auth/auth-card.tsx` do the same (add `"use client";`, the effect with `title`).

- [ ] **Step 4: Buttons keep focus while loading**

Replace the `Button` component in `apps/web/src/components/ui/button.tsx` (keep `buttonClasses` and the constants as they are) with:

```tsx
export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      // `aria-disabled` instead of `disabled` while loading keeps keyboard focus on the button.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          // Blocks the click, a form submit from this button and implicit submission via Enter.
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={buttonClasses({ variant, size, className: cn(loading && "pointer-events-none opacity-50", className) })}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
```

(Import `cn` from `@/lib/cn` if it is not imported yet. `onClick` is destructured before `...rest` so it is not applied twice.)

- [ ] **Step 5: Fix tests that relied on `disabled`**

Run the full suite and fix every e2e test that asserted a loading button with `toBeDisabled()` (for example the "Review" double-click, the send confirm, Account buttons): assert `aria-disabled="true"` (`toHaveAttribute("aria-disabled", "true")`) instead, keeping the behavioural assertions (a single request) intact. Playwright's actionability treats `aria-disabled` as not actionable, so tests that click a loading button on purpose use `click({ force: true })`.

- [ ] **Step 6: Write the e2e tests**

Create `e2e/page-titles.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { business, campaign, customer, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const draft = campaign("k-1", "Spring menu");

test.describe("page titles", () => {
  test("every signed-in page names itself", async ({ page }) => {
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
      ["/businesses/b1/campaigns/k-1/preview", "Spring menu · DireConnect"],
      ["/businesses/b1/campaigns/k-1/edit", "Edit campaign · DireConnect"],
      ["/account", "Account · DireConnect"],
    ];
    for (const [path, title] of cases) {
      await page.goto(path);
      await expect(page).toHaveTitle(title);
    }
  });

  test("the login and signup pages name themselves", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Log in · DireConnect");
    await page.goto("/signup");
    await expect(page).toHaveTitle("Create account · DireConnect");
  });
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
```

If a page title differs from the strings above (the titles come from each page's `PageHeader` `title`), assert the real `title` prop value, not a guess; the point is that every page has its own title.

- [ ] **Step 7: Run everything**

Run `npx tsc --noEmit -p apps/web`, `npm run lint -w apps/web`, `npx vitest run apps/web`, then the full `npx playwright test` (restore the tracked folders). Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): give every page its own title and keep focus on loading buttons

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Campaign follow-ups (auto-refresh, failed reason, limit messaging)

**Files:**
- Create: `apps/web/src/lib/useAutoRefresh.ts`, `apps/web/src/lib/useAutoRefresh.test.ts`, `apps/web/src/components/campaigns/detail/refresh-bar.tsx`
- Modify: `(detail)/analytics/page.tsx`, `(detail)/logs/page.tsx`, `lib/campaignDetail.ts` (+ test), `lib/campaignWizard.ts` (+ test), `components/campaigns/wizard/step-recipients.tsx`, `e2e/campaign-detail.spec.ts`, `e2e/campaign-wizard.spec.ts`

**Interfaces:**
- Produces: `shouldAutoRefresh({ status, visible }): boolean`; `AUTO_REFRESH_MS = 15_000`; `useAutoRefresh(active: boolean, refetch: () => void, intervalMs?: number): void`; `RefreshBar({ refreshing, error, onRefresh, onRetry? })`; `failureHeadline(failedByReason)` in `lib/campaignDetail.ts`; reworded over-limit `SendBlock`.

- [ ] **Step 1: Failing unit tests**

Create `apps/web/src/lib/useAutoRefresh.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AUTO_REFRESH_MS, shouldAutoRefresh } from "./useAutoRefresh";

describe("shouldAutoRefresh", () => {
  it("polls only a queued campaign on a visible page", () => {
    expect(shouldAutoRefresh({ status: "QUEUED", visible: true })).toBe(true);
    expect(shouldAutoRefresh({ status: "QUEUED", visible: false })).toBe(false);
  });

  it("never polls drafts or finished campaigns", () => {
    for (const status of ["DRAFT", "SENT", "FAILED"] as const) {
      expect(shouldAutoRefresh({ status, visible: true })).toBe(false);
    }
  });

  it("polls at a sensible interval", () => {
    expect(AUTO_REFRESH_MS).toBeGreaterThanOrEqual(10_000);
  });
});
```

Append to `apps/web/src/lib/campaignDetail.test.ts` (add `failureHeadline` to its import):

```ts
describe("failureHeadline", () => {
  it("names the most common failure reason", () => {
    expect(
      failureHeadline({ "Mailbox does not exist": 3, "Daily limit reached for this account": 1 }),
    ).toBe("Most messages failed because: Mailbox does not exist (3 of 4).");
  });

  it("is plain when there is a single reason", () => {
    expect(failureHeadline({ "Daily limit reached for this account": 2 })).toBe(
      "Messages failed because: Daily limit reached for this account (2 of 2).",
    );
  });

  it("returns null when nothing failed", () => {
    expect(failureHeadline({})).toBeNull();
  });
});
```

In `apps/web/src/lib/campaignWizard.test.ts` replace the over-limit test's message assertions with:

```ts
    expect(blocks[0].title).toBe("Too many recipients for now");
    expect(blocks[0].message).toContain("10");
    expect(blocks[0].message).toContain("11");
    expect(blocks[0].message).toMatch(/aren’t available yet/);
    expect(blocks[0].message).not.toMatch(/Update your customers/);
```

Run the three test files: FAIL.

- [ ] **Step 2: Implement the pure parts**

Create `apps/web/src/lib/useAutoRefresh.ts`:

```ts
"use client";

import { useEffect, useRef } from "react";
import type { CampaignStatus } from "./types";

export const AUTO_REFRESH_MS = 15_000;

/** Only a queued campaign is still changing, and polling a hidden tab is wasted work. */
export function shouldAutoRefresh({
  status,
  visible,
}: {
  status: CampaignStatus;
  visible: boolean;
}): boolean {
  return status === "QUEUED" && visible;
}

/**
 * Calls `refetch` every `intervalMs` while `active`, and once when a hidden tab becomes visible
 * again. The timer is cleared as soon as `active` turns false or the page unmounts.
 */
export function useAutoRefresh(
  active: boolean,
  refetch: () => void,
  intervalMs: number = AUTO_REFRESH_MS,
): void {
  const latest = useRef(refetch);
  useEffect(() => {
    latest.current = refetch;
  }, [refetch]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") {
        latest.current();
      }
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, intervalMs]);
}
```

Add to `apps/web/src/lib/campaignDetail.ts`:

```ts
/** One sentence naming why messages failed, for the top of the Results tab. */
export function failureHeadline(failedByReason: Record<string, number>): string | null {
  const reasons = failureReasons(failedByReason);
  if (reasons.length === 0) {
    return null;
  }
  const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
  const top = reasons[0];
  const lead = reasons.length === 1 ? "Messages failed because:" : "Most messages failed because:";
  return `${lead} ${top.label} (${top.count} of ${total}).`;
}
```

In `apps/web/src/lib/campaignWizard.ts` replace the over-limit block with:

```ts
  if (eligibleCount > max) {
    blocks.push({
      code: "over-limit",
      title: "Too many recipients for now",
      message: `DireConnect limits each campaign to ${pluralize(max, "recipient")} while sending is in early access, and this one would reach ${eligibleCount}. Larger campaigns aren’t available yet. Only turn off email consent for customers who have actually asked not to hear from you.`,
    });
  }
```

(The "Check again" button stays: it is still useful after a customer genuinely opts out.)

- [ ] **Step 3: Shared refresh bar and the two tabs**

Create `apps/web/src/components/campaigns/detail/refresh-bar.tsx` by extracting the Refresh button, the "Refreshing…" polite status (always mounted, text changes) and the "Couldn’t refresh. Showing the earlier numbers." notice with Try again from `(detail)/analytics/page.tsx` (read that page: it is the source of truth for the markup and the `aria-disabled` guard):

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

/** Refresh control shared by the Results and Delivery log tabs. */
export function RefreshBar({
  refreshing,
  failed,
  onRefresh,
}: {
  refreshing: boolean;
  /** A refresh failed while earlier data is still on screen. */
  failed: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button loading={refreshing} onClick={onRefresh}>
          <Icon name="clock" />
          Refresh
        </Button>
        <span role="status" aria-live="polite" className="text-[13px] text-muted">
          {refreshing ? "Refreshing…" : ""}
        </span>
      </div>
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-control border border-warning bg-warning-soft px-3 py-2 text-sm"
        >
          <span className="text-ink">Couldn’t refresh. Showing the earlier numbers.</span>
          <Button size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
```

Because `Button` now handles `loading` with `aria-disabled` and ignores clicks, the page no longer needs its own guard. Refactor the Results page to use `RefreshBar` (keeping every existing label, test id and behaviour: "Refreshing…", "Couldn’t refresh. Showing the earlier numbers.", "Try again", both refetches). Then:

- **Results tab:** call `useAutoRefresh(shouldAutoRefresh({ status: campaign.status, visible: true }), refresh)` where `refresh` reloads both the analytics and the campaign (the campaign reload flips the status to Sent, which stops the polling). Call the hook before any early return. For a FAILED campaign, show `failureHeadline(summary.failedByReason)` as a sentence at the top (above the notes) in `text-ink`, together with a note "This campaign didn’t finish sending."; add the same one-line failed-campaign note to `resultsNotes` in `lib/campaignDetail.ts` for `status === "FAILED"` and update its unit test.
- **Delivery log tab:** add the same `RefreshBar` (reloading the logs and the campaign), the same auto-refresh, and the "Refreshing…" state; render the stale-data notice when a refresh fails with data present. Keep the existing loading/error/empty states.

- [ ] **Step 4: Recipients-step warning**

In `apps/web/src/components/campaigns/wizard/step-recipients.tsx`, when `optedInCount !== null && optedInCount > CAMPAIGN_LIMITS.maxRecipientsPerCampaign`, show a warning panel (same styling as the zero-customers warning, with the title "More customers opted in than one campaign can reach") saying: "{optedInCount} customers have agreed to receive emails, but DireConnect limits each campaign to {max} recipients while sending is in early access. You can write the campaign now; sending will be blocked until it would reach {max} or fewer." Keep the existing sentence about the count.

- [ ] **Step 5: e2e tests**

Add to `e2e/campaign-detail.spec.ts` (use `page.clock` to avoid real 15s waits: `await page.clock.install()` before `goto`, then `await page.clock.runFor(16_000)`):

1. **Auto-refresh while queued:** a QUEUED campaign on the Results tab; after `runFor(16_000)` the analytics GET count increased; flip the mock campaign to SENT and `runFor(16_000)` again: the header shows Sent and after another `runFor(60_000)` the GET count did not grow (polling stopped).
2. **Not for finished campaigns:** a SENT campaign; after `runFor(60_000)` only the initial analytics GET happened.
3. **Delivery log:** Refresh button present; second logs GET fails: the "Couldn’t refresh" notice shows with the old rows; Try again recovers; a QUEUED campaign auto-refreshes its logs.
4. **Failed campaign:** a FAILED campaign with `failedByReason` shows the headline sentence ("Most messages failed because: …") and "This campaign didn’t finish sending.".

Add to `e2e/campaign-wizard.spec.ts`: 11 opted-in customers: the Recipients step shows the new warning; the Review step block reads "Too many recipients for now" and contains "aren’t available yet" and no "Update your customers". Update the existing over-limit test's title assertion accordingly.

- [ ] **Step 6: Run everything**

`npx tsc --noEmit -p apps/web`, `npm run lint -w apps/web`, `npx vitest run apps/web`, the touched specs, then the full `npx playwright test` (restore the tracked folders). Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): auto-refresh queued campaigns, explain failed ones, and clarify the recipient limit

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Safer password change

**Files:**
- Modify: `apps/web/src/lib/account.ts`, `account.test.ts`, `apps/web/src/app/(app)/account/page.tsx`, `e2e/helpers/app.ts`, `e2e/account.spec.ts`

**Interfaces:**
- Produces: `validatePasswordForm({ current, password, confirm })` (adds `current`); `PasswordFormValues` gains `current: string`; Account `PasswordPanel` with a "Current password" field, verified via `signInWithPassword`, then `updateUser`, then `signOut({ scope: "others" })`; mock options `authErrors.signIn` and `authErrors.signOutOthers`.

- [ ] **Step 1: Failing unit tests**

In `apps/web/src/lib/account.test.ts` update every `validatePasswordForm` call to include `current` and add:

```ts
  it("asks for the current password", () => {
    expect(validatePasswordForm({ current: "", password: "new-one", confirm: "new-one" })).toEqual({
      current: "Enter your current password.",
    });
  });

  it("refuses a new password equal to the current one", () => {
    expect(
      validatePasswordForm({ current: "same-one", password: "same-one", confirm: "same-one" }),
    ).toEqual({ password: "Choose a password that is different from the current one." });
  });
```

(Existing cases keep their expectations once `current: "old-password"` is passed in.) Run: FAIL.

- [ ] **Step 2: Implement the validation**

Replace `PasswordFormValues` and `validatePasswordForm` in `apps/web/src/lib/account.ts`:

```ts
export type PasswordFormValues = { current: string; password: string; confirm: string };

export function validatePasswordForm(values: PasswordFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.current) {
    errors.current = "Enter your current password.";
  }
  if (!values.password) {
    errors.password = "Enter a new password.";
  } else if (values.current && values.password === values.current) {
    errors.password = "Choose a password that is different from the current one.";
  }
  if (!values.confirm) {
    errors.confirm = "Repeat the new password.";
  } else if (values.password && values.confirm !== values.password) {
    errors.confirm = "The passwords don’t match.";
  }
  return errors;
}
```

- [ ] **Step 3: Change the Account page**

In `PasswordPanel` (`apps/web/src/app/(app)/account/page.tsx`): add the `current` value and a first field `TextField label="Current password" type="password" autoComplete="current-password" required` with `error={errors.current}`. In the submit handler, after client validation, within the existing `try/finally` that resets `saving`:

1. `const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: values.current })` (use `useSession().email`; if there is no email, show the form error "We couldn’t check your current password. Log out and back in, then try again."). On `verifyError`, set `errors.current = "That isn’t your current password."`, set the focus-after-render intent for the field and return (never call `updateUser`).
2. `updateUser({ password })` as today; on error keep the existing placement logic (password problems beside the new-password field, others in `FormError`).
3. After success: `const { error: othersError } = await supabase.auth.signOut({ scope: "others" })`. Clear the fields; toast `"Password changed"` when the call succeeded and `"Password changed. We couldn’t sign out your other devices; log out and back in there."` when `othersError` is set (still a success; the toast helper `success` is fine for both).

Keep the effect-driven focus handling Phase 5 added (do not use `requestAnimationFrame`).

- [ ] **Step 4: Mock and tests**

In `e2e/helpers/app.ts` extend the Supabase mock: `POST /auth/v1/token?grant_type=password` returns the same session payload as the refresh (a 400 `{ error_code: "invalid_credentials", msg: "Invalid login credentials" }` when `options.authErrors?.signIn` is set), and `POST /auth/v1/logout` with `?scope=others` records the request and returns 204 (or 500 when `options.authErrors?.signOutOthers` is set). Add `authErrors?: { updateUser?: string; signIn?: string; signOutOthers?: string }` to the options type.

Update `e2e/account.spec.ts`:
- every password test fills "Current password" too (`getByRole("textbox", { name: "Current password", exact: true })`; password inputs are `textbox`-role in this Playwright version only if they were before: keep using whatever locator the existing tests use for the other password fields);
- empty current password shows "Enter your current password." and nothing reaches `/auth/v1/user`;
- a wrong current password (mock sign-in error) shows "That isn’t your current password." beside that field, focuses it, and no PUT `/auth/v1/user` was recorded;
- success: the order of recorded auth requests is token (password grant) → PUT user → logout with `scope=others`; fields cleared; "Password changed" toast;
- `signOutOthers` failing still succeeds with the longer toast text;
- same new and current password shows the "different from the current one" error.

- [ ] **Step 5: Run everything**

`npx tsc --noEmit -p apps/web`, lint, `npx vitest run apps/web`, `npx playwright test e2e/account.spec.ts`, then the full suite (restore the tracked folders). Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): require the current password to change it and sign out other devices

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Forgot and reset password

**Files:**
- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`, `apps/web/src/app/(auth)/reset-password/page.tsx`, `e2e/password-recovery.spec.ts`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/lib/account.ts` (+ test, `validateResetEmail`), `e2e/helpers/app.ts`, `e2e/auth.spec.ts`

**Interfaces:**
- Produces: routes `/forgot-password` and `/reset-password`; a "Forgot password?" link on the login page; `validateResetEmail(email)`; mock routes `POST /auth/v1/recover` and `GET /auth/v1/user`.

- [ ] **Step 1: Failing unit test**

Append to `apps/web/src/lib/account.test.ts` (add `validateResetEmail` to the import):

```ts
describe("validateResetEmail", () => {
  it("accepts an email-looking value and trims it", () => {
    expect(validateResetEmail(" ada@example.com ")).toEqual({});
  });

  it("asks for an email, and for a valid one", () => {
    expect(validateResetEmail("")).toEqual({ email: "Enter your email address." });
    expect(validateResetEmail("   ")).toEqual({ email: "Enter your email address." });
    expect(validateResetEmail("not-an-email")).toEqual({ email: "Enter a valid email address." });
  });
});
```

Implement in `apps/web/src/lib/account.ts`:

```ts
export function validateResetEmail(email: string): Record<string, string> {
  const value = email.trim();
  if (!value) {
    return { email: "Enter your email address." };
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? {} : { email: "Enter a valid email address." };
}
```

- [ ] **Step 2: The forgot-password page**

Create `apps/web/src/app/(auth)/forgot-password/page.tsx` (client page using `AuthCard` like the login page): title "Reset your password", subtitle "Enter your email and we’ll send you a link to choose a new password."; one `TextField` (label "Email", `type="email"`, `autoComplete="email"`); on submit validate with `validateResetEmail` (inline error, focus the field with the effect-driven pattern the login page uses or `focusFirstInvalid` before any `await`); call `supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })`; **whatever the result is, except a rate-limit (status 429) or a network failure, replace the form with the same confirmation**: heading unchanged, text "If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder." and a "Back to log in" link (this avoids revealing whether an account exists). For a 429 show the error message in `FormError`; for a thrown/network error show "Could not send the email. Check your connection and try again.". Footer link "Back to log in".

- [ ] **Step 3: The reset-password page**

Create `apps/web/src/app/(auth)/reset-password/page.tsx` (client, `AuthCard`): title "Choose a new password". supabase-js (implicit flow, `detectSessionInUrl` default) reads the `#access_token=...&type=recovery` fragment from the emailed link and fires a `PASSWORD_RECOVERY` auth event. The page keeps `status: "checking" | "ready" | "invalid"`: subscribe with `supabase.auth.onAuthStateChange` for `PASSWORD_RECOVERY` (set `ready`) and also check `supabase.auth.getSession()` once after a short settle (set `ready` when a session exists *and* the event fired, otherwise after about 3 seconds of no event set `invalid`; unsubscribe on cleanup). `invalid` shows "This reset link has expired or was already used." and a button-styled link "Request a new link" to `/forgot-password`. `ready` shows the form: "New password" and "Repeat new password" (`autoComplete="new-password"`), validated with `validatePasswordForm({ current: "unused", password, confirm })` minus the `current` key (add a small `validateNewPassword(password, confirm)` helper to `lib/account.ts` with its own unit tests instead of faking `current`); on submit `supabase.auth.updateUser({ password })`; server password errors beside the field (reuse `passwordErrorTarget`), others in `FormError`; on success `supabase.auth.signOut({ scope: "others" })` (ignore its failure), toast "Password changed", `router.replace("/businesses")`. Use effect-driven focus (no `requestAnimationFrame`).

- [ ] **Step 4: Login link**

In `apps/web/src/app/(auth)/login/page.tsx` add a "Forgot password?" `Link` to `/forgot-password` right after the password field (`text-sm font-medium text-accent hover:underline`, `min-h-10 inline-flex items-center`). Keep the existing labels, placeholders and headings that `auth.spec.ts` and `home.spec.ts` rely on.

- [ ] **Step 5: Mock and e2e**

In `e2e/helpers/app.ts` Supabase mock add `POST /auth/v1/recover` (records the request; 200 `{}`; 429 `{ code: 429, error_code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" }` when `options.authErrors?.recover` is set) and `GET /auth/v1/user` (200 with the confirmed test user, used by supabase-js when it parses a recovery link). Add `recover?: string` to `authErrors`.

Create `e2e/password-recovery.spec.ts`:
1. Login page shows a "Forgot password?" link to `/forgot-password`; the forgot page validates empty and malformed emails inline without a network call.
2. Submitting a valid email sends one `/auth/v1/recover` request whose body contains the email and a `redirect_to` (or `redirectTo` as supabase-js names it in the URL/body; assert on whichever the client sends) ending in `/reset-password`, and shows the neutral confirmation text; submitting an address the mock treats as unknown (mock still answers 200) shows the same text.
3. A 429 from the mock shows the error in `FormError` and keeps the form.
4. `/reset-password` visited directly (no fragment) shows "This reset link has expired or was already used." with a link to `/forgot-password` (allow up to ~5 seconds).
5. `/reset-password#access_token=test-access-token&refresh_token=test-refresh-token&expires_in=3600&token_type=bearer&type=recovery` shows the form (this may require the mock `GET /auth/v1/user`; if supabase-js needs other endpoints for the implicit recovery flow, inspect `node_modules/@supabase/auth-js` and mock exactly those, noting it in the report); mismatched passwords show inline errors with no `PUT /auth/v1/user`; a valid pair sends `PUT /auth/v1/user` with the password and lands on `/businesses` with the "Password changed" toast.

- [ ] **Step 6: Run everything**

`npx tsc --noEmit -p apps/web`, lint, `npx vitest run apps/web`, `npx playwright test e2e/password-recovery.spec.ts e2e/auth.spec.ts e2e/home.spec.ts`, then the full suite (restore the tracked folders). Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src e2e
git commit -m "feat(web): add forgot and reset password

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Document and verify the phase

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`

- [ ] **Step 1: Update the spec in place** (no appended corrections):
- Section 7 "Auth pages": add the "Forgot password?" link, the forgot-password page (neutral confirmation, rate-limit/network error handling) and the reset-password page (expired link state, form, redirect), and the Supabase redirect-URL requirement.
- Section 7 "Account": the Password section now takes the current password (verified), signs out other devices after a change, and says what happens if signing out others fails.
- Section 7 "Campaign detail": Results and Delivery log refresh themselves every 15 seconds while a campaign is queued and the tab is visible, share the Refresh bar, and a failed campaign shows why; Results for a failed campaign shows the headline.
- Section 7 "Campaign wizard": the over-limit wording and the Recipients-step warning.
- Section 8: every page sets a distinct document title; buttons keep keyboard focus while loading (`aria-disabled`).
- Section 3a or 11: note the owner action (add `<origin>/reset-password` to the Supabase redirect URLs).

- [ ] **Step 2: Full verification** (read the real output):

```bash
npx tsc --noEmit -p apps/web
npm run lint -w apps/web
npx vitest run apps/web
npm test
npm run build -w apps/web
npx playwright test
git checkout -- playwright-report test-results
git clean -fdq playwright-report test-results
git status --short
```

Expected: tsc exit 0; lint 0 errors; vitest all pass; `npm test` has exactly one failing file (the known `env.js` baseline); the web build lists `/forgot-password` and `/reset-password`; Playwright all pass; `git status` shows only intended files.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs
git commit -m "docs(web): document password recovery, titles, auto-refresh and the recipient-limit wording

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Coverage of the follow-up list:** forgot-password flow (Task 4), current-password check and sign-out of other sessions (Task 3), unconfirmed-email UI (no code; the owner action is reported), page titles (Task 1), button focus on loading (Task 1), recipient cap (messaging only, Task 2 + Recipients warning), manual refresh gaps (auto-refresh + Delivery log Refresh, Task 2), failed-campaign reason (Task 2).

**Placeholder scan:** none; each step names files, behaviours, exact copy, and tests. Steps that depend on supabase-js internals (recovery fragment handling, token endpoint shape) say how to inspect `node_modules/@supabase/auth-js` and report.

**Type consistency:** `validatePasswordForm` gains `current` in Task 3 and the reset page uses a separate `validateNewPassword` (Task 4) so nothing fakes the field; `RefreshBar` props (`refreshing`, `failed`, `onRefresh`) are used by both tabs; `useAutoRefresh(active, refetch, intervalMs?)` and `shouldAutoRefresh({status, visible})` are defined once in Task 2.
