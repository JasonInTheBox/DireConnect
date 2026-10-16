# DireConnect UI/UX Redesign: Design Spec

Date: 2026-10-08 (revised 2026-10-10 after the Vercel/Render/Railway migration and the campaign safeguards; see section 3a)
Scope: `apps/web` only. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts.

## 1. Goal

Turn the current page-per-route, dark-only frontend into a cohesive, accessible, responsive SaaS interface for non-technical small-business owners. The work is mainly structural (app shell, business context, reusable components, task flows); restyling is secondary.

Success looks like:
- A persistent shell with an always-visible "which business am I managing" switcher.
- Every page built from shared components; no page file over about 150 lines.
- Consistent loading, empty, error and success feedback; no `alert()` or `window.confirm`.
- Campaign creation as a guided flow with preview, validation, an email preview, clear explanations of the sending limits, and a confirmation before sending.
- Keyboard-operable, visible focus, accessible contrast, reduced-motion support, usable at phone width.
- Existing behaviour preserved: auth, business ownership checks (server side), all API calls, existing URLs.

## 2. Non-goals

- No backend, schema or API changes. No new campaign statuses, no trend/time-series data, no profile or settings endpoints.
- No new runtime dependencies (no shadcn/Radix, no TanStack Query, no icon library).
- No navigation entries for features that do not exist (no business-level Analytics, no separate Settings, no communication preferences, no merge fields in messages).
- No UI for creating, editing or sending SMS campaigns: the API rejects them (see 3a). SMS data is kept and legacy SMS campaigns stay visible.
- Do not hide, soften or work around the safeguards in 3a. The UI explains them; the API remains the authority.
- No manual theme toggle; dark mode follows the OS setting.

## 3. Facts about the current system this design relies on

- Campaign statuses are `DRAFT | QUEUED | SENT | FAILED`. "Scheduled" is displayed for `QUEUED` with a future `sendAt`.
- Only `DRAFT` campaigns can be edited or deleted. Queueing is `POST .../campaigns/:id/queue`; there is no cancel.
- Exact recipient eligibility is computed server-side (`GET .../campaigns/:id/preview`). The UI does not re-implement those rules.
- `GET /api/businesses/:id/dashboard` returns counts only (customers, campaigns by status, messages, recent campaigns).
- The customer list API returns all rows; search and pagination are client-side.
- The current campaign form sends `datetime-local` text without a time zone. The redesign sends an ISO timestamp (`new Date(value).toISOString()`), and converts an ISO `sendAt` back to local time when editing. This is the only intended change in request payload shape (still a valid string for the existing schema).
- `apps/web/AGENTS.md` states this Next.js version has breaking changes; the relevant docs in `node_modules/next/dist/docs/` must be read before writing code.
- Existing e2e tests rely on: home page links named "Log in" and "Sign up"; login page heading "Log in" and placeholders `you@example.com` and `Your password`. These stay.

## 3a. Changes since the first draft (deployment migration and safeguards)

Deployment: Vercel (web), Render free web service (API), Railway (BullMQ worker), Supabase, Resend. AWS files are gone.

Backend rules the UI must respect (all verified in the code):
- **SMS is disabled.** `POST`/`PUT` campaign with `channel: "SMS"` returns 422; queueing an SMS draft returns 409; the worker fails legacy SMS jobs. Existing SMS campaigns and SMS consent fields remain in the database.
- **Audience.** For an EMAIL campaign, `ALL` and `EMAIL_OPTED_IN` produce the same recipients, because eligibility always requires email opt-in, an email address and no unsubscribe. The UI offers no audience choice for new campaigns (it sends `ALL`); when editing a legacy `EMAIL_OPTED_IN` draft it preserves that value.
- **Queue-time checks** (`POST .../queue`): in production, 403 "Confirm your account email before sending campaigns." and 403 "Campaign sending is not enabled for this account." (sender allowlist); 409 when zero eligible recipients; 409 when more than 10 eligible recipients (`CAMPAIGN_EMAIL_SAFETY_LIMITS.maxRecipientsPerCampaign`, response includes `eligibleCount` and `maxRecipients`).
- **Delivery-time limits** (worker, not knowable beforehand): 25 emails per account, 100 per platform, 1 per recipient, each per rolling 24 hours. Blocked recipients appear as FAILED message logs with a human-readable `errorMessage`.
- **Customers.** New customers default to email opt-out. The consent checkbox wording is "Customer explicitly agreed to receive promotional emails" and must stay explicit and unchecked by default.
- **Consent cannot distinguish "never opted in" from "unsubscribed".** Creating or editing a customer with no opt-ins stores `unsubscribedAt = now`, and the unsubscribe link sets `emailOptIn=false` plus `unsubscribedAt`. The Customers UI therefore shows two states: "Email opted in" (`emailOptIn && !unsubscribedAt`) and "Email not opted in".
- **Businesses.** Website input is normalised server-side (a bare domain gets `https://`).
- **Render free tier** sleeps after 15 minutes idle and can take about a minute to wake. First requests after idle are slow, not broken.
- **Worker offline.** Queued or scheduled campaigns wait until the worker runs.
- The web app uses `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The landing page pings `/health` (a quiet warm-up); this is kept.
- `apps/web/eslint.config.mjs` now uses `FlatCompat` with `next/core-web-vitals` and `next/typescript`; `npm run lint` must stay clean for new code.

## 4. Visual system

Direction: quiet, neutral surfaces, one deep-teal accent used for primary actions, links, focus rings and the selected-business marker only.

| Token | Light | Dark |
|---|---|---|
| canvas | `#F6F7F8` | `#0E1113` |
| surface | `#FFFFFF` | `#15191C` |
| line (border) | `#E3E6EA` | `#262C31` |
| ink (text) | `#14181F` | `#E8EBED` |
| muted | `#5B6572` | `#98A2AB` |
| accent | `#0B6E73` (soft `#E2F1F1`) | `#4DB6BC` |
| success / warning / danger | `#1A7F4B` / `#9A6700` / `#C02A2A` | lightened equivalents |

Final values are validated for WCAG AA contrast during implementation; adjust within the same hues if any pair fails.

- Typography: Geist (already loaded). Remove the `font-family: Arial` override in `globals.css`. Body 14px; page title 20px semibold; section heading 15-16px semibold; table 13px; helper text 12-13px; numbers `tabular-nums`. Sentence case, no all-caps labels, no monospace labels.
- Shape and depth: 6px radius on controls, 10px on containers and dialogs. Containers use borders; shadow only on floating layers (menus, dialogs, toasts).
- Motion: 120-160ms ease-out, only in response to user action (dialog open/close, drawer, sidebar collapse, toast). Nothing animates on load. `prefers-reduced-motion: reduce` disables all transitions.
- Status badges: dot or icon plus text label (Draft, Queued, Scheduled, Sent, Failed). Never colour alone. Channel (Email/SMS) uses a single neutral badge style so colour keeps its meaning for status.
- Distinctive element: the business switcher (monogram tile, business name, "Managing" caption) pinned at the top of the sidebar.
- Tokens are CSS variables in `globals.css`, exposed to Tailwind v4 via `@theme` (utilities such as `bg-surface`, `border-line`, `text-muted`, `text-ink`, `bg-accent`). Dark values via `@media (prefers-color-scheme: dark)`.
- Titles: the root layout sets only a metadata description; it sets no title. Every page renders its own `<title>` ("<page> · DireConnect", from `lib/pageTitle.ts`) through `PageHeader` or `AuthCard`, and the screens that have no header (the landing page, the shell skeleton, the business loading and error states, "Business not found", and the campaign detail loading, error and not-found states) render one directly. React hoists it into `<head>`, on the server too, so there are no `document.title` effects.

## 5. Architecture

### 5.1 Routes (URLs unchanged unless noted)

```
app/
  layout.tsx                       root: fonts, metadata description, globals, ToastProvider
  page.tsx                         landing (logged out) / redirect to /businesses (logged in)
  (auth)/login, signup, forgot-password, reset-password   centred auth layout
  (app)/layout.tsx                 auth guard, providers, shell
  (app)/account/page.tsx           NEW
  (app)/businesses/page.tsx
  (app)/businesses/[businessId]/layout.tsx          selected-business context + 404 state
  (app)/businesses/[businessId]/dashboard
  (app)/businesses/[businessId]/customers
  (app)/businesses/[businessId]/campaigns            list
  (app)/businesses/[businessId]/campaigns/new        NEW wizard
  (app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/layout.tsx   header + tabs
  (app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/page.tsx     redirect (Results, or Audience for drafts)
  (app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/preview      tab "Audience"
  (app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/analytics    tab "Results"
  (app)/businesses/[businessId]/campaigns/[campaignId]/(detail)/logs         tab "Delivery log"
  (app)/businesses/[businessId]/campaigns/[campaignId]/edit         NEW (same wizard, drafts only)
  (app)/businesses/[businessId]/campaigns/[campaignId]/send         NEW (same wizard, opens on Review and send)
```

`app/customers/page.tsx` (redirect to /businesses) is kept. Login success redirects to `/businesses`. Moving files into route groups does not change URLs. The detail layout sits in the `(detail)` route group so it wraps only the index, `preview`, `analytics` and `logs`; `edit` and `send` are outside the group because the wizard has its own header.

### 5.2 Data layer (`src/lib`)

- `apiClient.ts`: `apiFetch<T>(path, { method?, body? })` attaches the Supabase bearer token, redirects to `/login` on missing session or 401, throws `ApiError { status, message }` using the backend's `{ error }` field; handles 204.
- `useApi.ts`: `useApi<T>(path | null)` returns `{ data, error, loading, slow, refetch }`, aborts on unmount (React StrictMode safe). `slow` becomes true after about 4 seconds without a response; pages and the shell then show "Waking up the server. The first load after a quiet period can take up to a minute." instead of a bare skeleton. The request timeout is generous (about 90 seconds) so a cold start is not reported as a failure; only after that does the ErrorState with Retry appear.
- `types.ts`: shared `Business`, `Customer`, `Campaign`, `CampaignStatus`, `CampaignChannel`, `CampaignAudience`, dashboard and analytics response types (replacing per-page copies).
- `api.ts` (`apiUrl`) and `supabase.ts` unchanged.

Feedback convention: load failure gives an inline `ErrorState` with Retry; failed action gives an error toast with the server message; field validation is inline (`aria-invalid`, `aria-describedby`); success is a toast reusing the button's verb; submitting disables the button and shows a spinner.

### 5.3 Components (`src/components`)

- `ui/`: Button, Field, Input, Textarea, Select, Checkbox, Dialog (native `<dialog>` + `showModal()`), ConfirmDialog (optional "type the name to confirm"), Menu, Tabs, Badge, StatusBadge, Table, Skeleton, EmptyState, ErrorState, Spinner, Toast (provider + live region), PageHeader, Breadcrumbs, `icons.tsx` (inline SVG).
- `shell/`: AppShell, Sidebar, MobileDrawer, BusinessSwitcher, BusinessesProvider/context, UserMenu.
- `business/`, `customers/`, `campaigns/`: feature components (forms, tables, wizard steps, previews, charts).

Tables scroll horizontally in their container; the customer table collapses to stacked rows on narrow screens.

## 6. Shell and navigation

- `(app)/layout.tsx`: auth guard (skeleton shell while checking; redirect to `/login` if no session), `BusinessesProvider` (single `GET /api/businesses`; `ToastProvider` lives in the root layout, above both route groups, so a toast fired just before a navigation between them survives it), sidebar and main landmark, skip-to-content link.
- Sidebar items, only for existing pages:
  - Workspace: Businesses.
  - Selected business (shown inside a business, headed by its name): Dashboard, Customers, Campaigns.
  - Account: a group with one entry, Account, which links to `/account`; the signed-in email and Log out stay at the foot.
- Active item: `aria-current="page"` plus accent marker.
- BusinessSwitcher: menu button (monogram, name, "Managing"); menu lists businesses with keyboard support (arrows, type-ahead, Escape) and "Create business" (dialog, then navigate to the new dashboard). Switching preserves the section (`/businesses/A/customers` to `/businesses/B/customers`); from campaign detail it goes to the new business's campaign list. Outside a business the button reads "Select a business".
- Selected business is derived from the URL param. If the ID is not in the user's list, show "Business not found" with a link back (server ownership checks unchanged).
- Header: breadcrumbs (Businesses > name > section > item), 20px title, slot for the primary action.
- Responsive: at 1024px and up a full sidebar collapsible to a 64px icon rail (preference in `localStorage`, wrapped in try/catch); below 1024px an off-canvas drawer opened from a top-bar hamburger (reuses Dialog for focus trap and Escape).
- `/` shows a minimal landing for logged-out users (keeping "Log in" and "Sign up" links), redirects logged-in users to `/businesses`; the unused health fetch is removed.

## 7. Pages

**Businesses.** Two-column card grid: monogram, name, clamped description, contact line, **Open**; menu with Edit and Delete (delete requires typing the business name; deletion cascades to customers and campaigns). "New business" opens the shared create/edit dialog. Empty state with a create action. The current business is marked in the sidebar switcher, not on this page: selection comes from the URL, and `/businesses` is outside any business.

**Customers.** Toolbar: search (name, email, phone), consent filter (All customers, Opted in to email, Not opted in), count, **Add customer**. Add/Edit share a dialog. Columns: Name, Email, Phone, Email consent badge (Email opted in / Email not opted in), row menu (Edit, Delete with confirm). The form's email consent checkbox is unchecked by default, keeps the wording "Customer explicitly agreed to receive promotional emails", and has helper text explaining that only customers who agreed can receive campaigns. SMS consent is not a primary control (SMS is paused): the form passes the existing `smsOptIn` value through unchanged on edit so it is never overwritten, and a small "SMS opted in" badge appears only for customers who have it. Client-side pagination beyond 50 rows. Empty states: first customer; no search matches. Skeleton while loading; ErrorState with Retry.

**Dashboard.** Built only from `/dashboard` data. A header with the quick actions "Add customer" and "New campaign" (which opens the campaign wizard). A setup checklist ("Add your first customer", "Send your first campaign"), shown only while a step is open and driven by real counts. A Customers panel with the total and "Opted in to email", plus "Not opted in", which is derived as the total minus the opted-in count because the API's unsubscribed count also includes people who never opted in; SMS counts are not shown while SMS is paused. A Campaigns panel with the status counts Draft, Queued, Sent and Failed; a queued campaign shows as "Queued" because the payload has no send date, so "Scheduled" arrives with the campaign list. A Delivery panel with one stacked bar and an icon-and-label legend listing every state with its count and percentage (tiny shares are shown as "<1%" and near-total shares as ">99%", so a percentage never contradicts a visible failure), and a success rate computed from sent ÷ (sent + failed) with pending messages noted as not counted, or "No messages sent yet"; the hover tooltip is the native title and the legend always shows every value. A Recent campaigns list of the latest five, as a responsive list of rows rather than a table. No trend charts. The business's own details live on the Businesses page, reached from a footer link.

**Campaign list.** A table from `xl` (1280px) up and stacked cards below, because with the sidebar open the content column is too narrow for six columns at `lg`. Columns: Name (links to the campaign), Channel, Status, When, Delivery, and a row menu. The audience column is dropped (it carries no information for email). Statuses, each with an icon and a label: Draft, Queued ("Waiting to be sent"), Scheduled, Sent, Failed. Scheduled is derived on the client: a queued campaign whose `sendAt` is in the future; a queued campaign without a future time stays Queued. The When column reads "Planned for <time>" for a draft with a send time and "Not scheduled" for one without; "Waiting to be sent" for Queued; the scheduled time for Scheduled; and the send time (falling back to the last update) for Sent and Failed. The Delivery column reads "Not sent yet" for drafts and otherwise "3 of 4 sent, 1 failed" (the failed and pending parts appear only when above zero), "No recipients" when every count is zero, "Loading…" while the numbers arrive and "Unavailable" when that campaign's request fails, so one failure never breaks the other rows. Delivery numbers are fetched only for non-draft campaigns on the visible page, one analytics request each. The list shows 25 campaigns per page. Legacy SMS campaigns show an "SMS" badge and the note "SMS sending is paused"; an SMS draft offers Delete only, and any non-draft campaign (queued, sent or failed) offers no row actions. Email drafts offer Edit (opens the wizard) and Delete, which asks for confirmation ("This removes the draft. This can’t be undone."). Campaign names open the campaign detail: its Audience tab for drafts and its Results tab for everything else. The Audience tab is read-only and never queues a campaign; sending happens only through the wizard's confirm dialog. With no campaigns, an empty state offers "Create your first campaign".

**Campaign wizard** (`/campaigns/new`, `/campaigns/[id]/edit`). Four steps with a step indicator, titled "Basics", "Recipients", "Message" and "Review and send". What the user typed is kept while moving between steps, and focus moves to the new step's heading on every change. The page is keyed by business, so switching business in the middle of the wizard lands on that business's campaign list instead of carrying state across.
1. Basics: campaign name (the hint says customers see it as the email subject). A fixed "Email" channel label with the note "Campaigns are sent by email."; no channel choice is offered.
2. Recipients: explains in plain language who receives the campaign (customers who agreed to receive promotional emails, have an email address and haven’t unsubscribed) and that no audience needs choosing. Shows how many customers "have agreed to receive emails", read from the dashboard endpoint's opted-in count. That count can include customers who have no email address, so the step says the exact list is checked on the last step. If the count is zero, a warning offers an "Add customers" link that opens in a new tab so the wizard state is not lost. If the count cannot be loaded, the step says so and defers to the last step. If that count is above the 10-recipient cap, a warning titled "More customers opted in than one campaign can reach" says DireConnect limits each campaign to 10 recipients while sending is in early access, that the user can still write the campaign, and that sending is blocked until it would reach 10 or fewer; it does not suggest changing anyone’s consent. Two sending limits are listed: up to 10 recipients per campaign, and one campaign email per customer per 24 hours. The cap itself is unchanged; only the wording explains it.
3. Message: a textarea and a live email preview card. The subject is the campaign name. The preview mirrors the worker's email template: a "Promotion from <business name>" header, the campaign name as a heading, the message, the opt-in line with an unsubscribe link, and a "Powered by DireConnect" footer. Emails are sent from DireConnect's own sending address, so the preview shows no sender row naming the business, and a note says so and that every email includes an unsubscribe link. The character count is informational only. No merge fields.
4. Review and send: entering this step creates the draft (first time) or updates it (afterwards) and says so on the page. Going back and returning updates the same draft; a double activation creates one draft. The step loads the draft's `/preview` for exact numbers: how many customers will receive the campaign and how many will be skipped, with the reasons merged into plain language ("Hasn’t agreed to receive emails", "No email address"). The user chooses "Send now" or "Schedule for later" (a date and time that must be in the future); once "Schedule for later" is selected, the date field appears with the time zone note "Times are shown in your time zone (…)". A draft that already carries a past send time opens as Send now, not as an error. If the recipient check itself fails to load, the step shows the error with its own "Try again" button. Three blocking states each show a plain-language explanation and disable the send button: no one can receive the campaign; more than 10 eligible recipients (titled "Too many recipients for now"; the message says the limit applies "while sending is in early access", states the current count, says larger campaigns aren’t available yet, and only reminds the user to turn off email consent for customers who have actually asked not to hear from you, so it never nudges anyone to edit consent to fit); and the signed-in account's email is not confirmed. "Check again" reloads the recipient numbers and appears only while a no-recipients or over-limit block is showing. The "email not confirmed" block is titled "Confirm your email address first", tells the user to open the Account page to resend the confirmation email or check the status and then come back to this draft, and carries an "Open Account" link to `/account` that opens in a new tab so the half-written wizard is kept.

   The final button ("Send now" or "Schedule campaign") opens a confirm dialog. For now: "Send to N customers now?" with "Queued campaigns can’t be edited or cancelled." For later: "Schedule for N customers?" with "Your campaign will be sent on <date and time>." followed by the same note. Confirming first saves the chosen timing to the draft with a `PUT` and then queues it, because the queue step reads the stored send time. If the API refuses (for example 403 "Campaign sending is not enabled for this account." or 409), the dialog closes and a persistent inline panel on the Review step, titled "The campaign wasn’t sent", shows the server's message and says the draft is saved; the panel stays until the user acts. After a successful queue the user lands on the campaign's Results tab with a toast ("Campaign queued" or "Campaign scheduled"). The Review step itself notes beforehand that delivery happens in the background and that daily sending limits may mark some recipients as failed; the Results tab repeats the same note.
- "Save draft" is available at any step once name and message are non-blank and is visually distinct from the send action. It saves and returns to the campaign list with a "Draft saved" toast; it is not a silent autosave. Whitespace-only names and messages fail validation like empty ones. Inline validation runs per step and focus moves to the first invalid field. Server field errors (title, message) return the user to the step that owns the field.
- Editing a sent, queued or SMS campaign is not offered (the API rejects it). Visiting `/edit` for such a campaign, or for an id that does not exist, shows an explanation with a "Back to campaigns" link: "Queued and sent campaigns can’t be edited." or "SMS sending is paused, so this campaign can’t be edited." under the title "This campaign can’t be edited", or, for an unknown id, the title "Campaign not found" with the description "This campaign doesn’t exist or was deleted." Never a blank form. The API has no single-campaign endpoint, so the edit page reads the list and finds the campaign by id.
- Schedule values are sent as ISO timestamps converted from the user's local time.

**Campaign detail.** A shared layout in the `(detail)` route group wraps the index address and the three tab routes. It reads the campaign list (there is no single-campaign endpoint) and finds the campaign by id; while loading it shows a skeleton, a failed load shows an error with Retry, and an unknown id shows "Campaign not found" with a "Back to campaigns" link. The header has breadcrumbs (Businesses, the business, Campaigns, the campaign), the campaign title as the page's `<h1>`, and a summary row with the status badge, the channel badge, the When text (as in the campaign list), a "SMS sending is paused" note for SMS campaigns, and the message clamped to three lines. The header actions are for email drafts only: "Review and send" opens the wizard on its Review step (`/send`), "Edit" opens it on the first step (`/edit`), and "Delete" asks for confirmation ("This removes the draft. This can’t be undone.") and then returns to the campaign list with a "Campaign deleted" toast; if the delete is refused, the server message shows in the dialog and the campaign is reloaded so draft actions disappear if it was queued meanwhile. An SMS draft offers Delete only; queued, sent and failed campaigns offer no actions. Below the header, a "Campaign sections" navigation holds three route links, Audience, Results and Delivery log, with `aria-current="page"` on the current one (links rather than an ARIA tablist, because each tab is its own page). The bare campaign address redirects to Audience for a draft and to Results for any other status.

- *Audience* is read-only. An intro line depends on the status: a draft shows who would receive the campaign right now, a queued or sent campaign shows the recipients fixed when it was queued, and an older campaign without a saved recipient list says its audience is matched against today’s customers. A Summary panel shows Customers checked, Will receive it and Skipped; a second panel lists the skip reasons merged into plain language, or says no customers were skipped. Below, paged lists (25 per page) of Recipients and Skipped customers, the latter with each reason. There is no queue button.
- *Results* is empty for a draft ("No results yet", with a "Review and send" link when sending is possible) and does not request analytics. Otherwise it shows notes (a queued campaign is waiting to be sent, a scheduled one shows its time, and delivery happens in the background so numbers can lag and daily limits can fail some recipients), a notice for older campaigns whose numbers are estimated from message logs, and the shared Refresh bar (see below). For a failed campaign the notes include "This campaign didn’t finish sending." and, above them, a headline naming the most common failure reason from the delivery results ("Most messages failed because: <reason> (3 of 4).", or "Messages failed because: …" when there is only one reason), so the reason is visible without opening the log. Below are the Delivery bar reused from the dashboard (with its own text when no messages have gone out), a Recipients panel (Customers checked, Eligible when queued, Skipped before sending), the skip reasons, and "Why messages failed", which lists the failure reasons in the worker’s own wording, most common first.
- *Delivery log* opens with a "Why a message can fail" panel that lists the sending limits (one email per customer, 25 per account and 100 for the platform, each per 24 hours; the values mirror the API’s constants and a test fails if they drift). A count line ("3 messages, 1 failed") precedes the data: a table from `lg` (1024px) up and cards below, each row showing the recipient, a status badge with an icon (Sent, Failed, Pending), the send time or "Not sent", and the failure reason. A campaign with no messages shows "No messages yet". The tab carries the same Refresh bar as Results.
- *Refresh bar and auto-refresh.* Results and Delivery log share one `RefreshBar`: a Refresh button that reloads the tab’s data and the campaign header together. The button stays enabled (it uses `aria-disabled`, so focus is kept), shows "Refreshing…" in a polite live region and ignores clicks meanwhile; if a reload fails the earlier data stays with a "Couldn’t refresh. Showing the earlier numbers." notice and a Try again button, and a failed reload of the campaign itself shows a similar notice under the header. While a campaign is queued (scheduled campaigns included) both tabs also refresh themselves every 15 seconds, and once when a hidden tab becomes visible again. Polling runs only while the tab is visible, skips a tick while a reload is still in flight so requests never stack, and stops as soon as the status changes or the page unmounts. Draft, sent and failed campaigns are not polled.

**Auth pages.** Centred layout, real `<label>`s, inline errors replacing `alert()`, loading state. Headings and placeholders required by e2e tests are preserved.

- *Log in* has a "Forgot password?" link (to `/forgot-password`) between the password field and the submit button.
- *Forgot password* (`/forgot-password`, title "Reset your password") asks for an email address, validates it on the client (empty or malformed addresses never reach Supabase) and calls `supabase.auth.resetPasswordForEmail` with `redirectTo` set to `<origin>/reset-password`. Whatever Supabase answers, the page shows the same neutral confirmation, "If an account exists for <email>, a reset link is on its way. Check your inbox and spam folder.", with a "Back to log in" link, so it never reveals whether an address has an account. That includes the per-account cooldown (a 429 saying the request can only be repeated after some seconds, which Supabase sends only for existing accounts), which is treated as success. Two failures are shown instead, as a form error: any other 429 ("Too many requests. Wait a few minutes and try again.", never the raw Supabase text) and a network failure ("Could not send the email. Check your connection and try again.").
- *Reset password* (`/reset-password`, title "Choose a new password") is reached from the emailed link, which carries a recovery session in the address fragment. While the link is being checked it shows "Checking your reset link…". The form ("New password", "Repeat new password", "Change password") appears only when the link is accepted: either supabase-js reports `PASSWORD_RECOVERY`, or the access token of the session it saved equals the token of the recovery link, which `lib/supabase.ts` records at module load because the event can fire before any page subscribes. A link that was rejected never replaces an existing session, so a visitor who is merely signed in is not let through. Otherwise (a direct visit, an expired or reused link, or no acceptance within about 3 seconds) the page says "This reset link has expired or was already used." with a "Request a new link" button to `/forgot-password` and a "Back to log in" link. The form refuses empty or mismatched values on the client (there is no current-password field: the emailed link is the proof); a refusal about the password from Supabase appears beside the field, any other failure as a form error. On success the page removes the link’s tokens from the address bar, ends the user’s other sessions (`signOut({ scope: "others" })`; a failure there is ignored and is not reported as a failed change), shows a "Password changed" toast and replaces the route with `/businesses`; the button stays busy until the navigation.
- Owner action: add `<site origin>/reset-password` (production, and any preview or local origin in use) to the Supabase redirect allow-list (Authentication > URL Configuration > Redirect URLs). Without it, the emailed link does not land on the reset page.

**Account.** The page at `/account` (breadcrumb and title "Account") holds three panels. *Sign-in* shows the email (read-only) and an email status badge, "Email confirmed" or "Email not confirmed". While the email is unconfirmed it explains that campaigns can only be sent from accounts with a confirmed address and offers "Resend confirmation email" (`supabase.auth.resend`, toast "Confirmation email sent") and "I’ve confirmed it" (`supabase.auth.refreshSession`; a confirmed result shows "Email confirmed" and the buttons disappear, an unconfirmed result says "Your email isn’t confirmed yet. Open the link in the confirmation email first."). *Password* has "Current password", "New password" and "Repeat new password" and a "Change password" button. Empty values, a mismatch, or a new password equal to the current one are refused on the client with inline errors and focus on the first one, and never reach Supabase. Supabase’s `updateUser` does not check the old password, so the current one is verified first with `supabase.auth.signInWithPassword` for the signed-in email (it replaces the local session with an equivalent one for the same user, so nothing remounts). Only a refusal that means wrong credentials (`invalid_credentials`, or a 400 with no error code) shows "That isn’t your current password." beside the current-password field; any other refusal (captcha, rate limit, unconfirmed email) or a thrown network error appears as a form error with its own text, and a wrong current password never reaches `updateUser`. Then the change is made through `supabase.auth.updateUser`: a refusal about the password (for example too short or unchanged) appears beside the new-password field and keeps what was typed; any other failure appears as a form error. After a successful change the user’s other sessions are ended with `signOut({ scope: "others" })`, which keeps this device signed in. Success clears all three fields and shows a "Password changed" toast; if ending the other sessions fails, the change still counts as successful and the toast reads "Password changed. We couldn’t sign out your other devices; log out and back in there." *Session* says "Log out of DireConnect." with a Log out button, which signs out everywhere (this device only, if that fails) and returns to the login page. Every button resets its loading state even if its request throws.

## 8. Accessibility

Semantic landmarks and heading order; skip link; visible focus rings on all interactive elements; labelled inputs with error association; native `<dialog>` focus management and Escape; the menu follows the WAI-ARIA menu keyboard pattern, and the campaign detail tabs are route links in a navigation landmark with `aria-current="page"` (plain Tab and Enter, not a tablist); toast live region (polite for success, assertive for errors); contrast AA in both themes; status never by colour alone; targets of at least 40px on touch layouts; reduced-motion respected. Every page has a distinct document title (WCAG 2.4.2; see section 4). A button that is loading uses `aria-disabled` and `aria-busy` rather than `disabled`, so keyboard focus stays on it; its click handler returns early and prevents the default action, which also blocks a form submit from that button and implicit submission with Enter, so a loading button never double-submits.

## 9. Testing and verification

- Vitest runs in the `node` environment with no DOM or Testing Library, and this redesign adds no test dependencies. Logic is therefore extracted into pure functions and unit-tested in Node: `apiFetch` error mapping and the slow-response timing, local-time/ISO schedule conversion, wizard step validation, send-blocking rules (zero recipients, over the limit, unconfirmed email), SMS-legacy display rules, status derivation (Draft / Queued / Scheduled / Sent / Failed), and customer filtering/search.
- Component behaviour (dialogs, focus, wizard flow, switcher) is checked with Playwright, which is already in the repo, using mocked network responses for the API and Supabase session. Keep the existing e2e tests passing; update selectors only where they change.
- `npm run lint` and `npm run build -w apps/web` must pass.
- Manual/visual check in a browser at 375, 768 and 1280px in light and dark, keyboard-only pass on shell, dialogs and the wizard. Authenticated pages need local Supabase and API environment values; if unavailable, authenticated screens are verified with mocked responses and this limit is stated in the final report.

## 10. Delivery phases (each shippable)

1. Tokens, data layer, the primitives the shell needs (Button, Field, Dialog, Menu, Toast, Skeleton, EmptyState/ErrorState, Icon), app shell, business switcher, auth pages, landing fix. Remaining primitives (Select, Checkbox, ConfirmDialog, Table, Tabs, Badge/StatusBadge, PageHeader, Breadcrumbs) are added in the phase that first uses them.
2. Businesses and Customers pages. The customer table appears at lg and above and stacks into cards below; the Businesses page reads the shared businesses list.
3. Dashboard. "New campaign" and the recent-campaign links point at the existing campaigns routes until phases 4 and 5 re-point them.
4. Campaign list and wizard.
5. Campaign detail tabs and Account page.
6. Hardening: password recovery (forgot and reset password), the current-password check and sign-out of other sessions, page titles, buttons that keep focus while loading, auto-refresh for queued campaigns, failed-campaign reasons, and clearer recipient-limit wording.

## 11. Open items to confirm during planning

- Resolved in Phase 4: `apps/web` does not import `CAMPAIGN_EMAIL_SAFETY_LIMITS` from `@direconnect/validation` (that needs a workspace dependency and the package built before the web build). The safety limits are mirrored in `apps/web/src/lib/campaignLimits.ts`, and a unit test imports the package's source file and fails if the values drift.
- Resolved: the Supabase browser session is mocked in Playwright by seeding its storage key and intercepting the Supabase auth routes (`e2e/helpers/app.ts`).
- Owner action for password recovery: add `<site origin>/reset-password` to the Supabase redirect URLs (see Auth pages). Whether "Confirm email" is on in Supabase needs no code change: the unconfirmed-email UI on Account and in the wizard is correct either way.
- Accepted risks recorded in review. (1) The recovery link uses Supabase’s implicit flow, so a logged-in visitor who opens a link crafted by someone else with that person’s own valid recovery token has their session replaced by the one in the link; this can only be closed by moving to the PKCE flow, which is out of scope. (2) Rate-limit (429) responses on the forgot-password page other than the hidden per-account cooldown may correlate with existing accounts.
- Local run requirements (Supabase URL/keys, API URL) for authenticated verification against real data.
- Contrast results for final token values.
- Read the Next.js docs in `node_modules/next/dist/docs/` for layouts, route groups, `params` handling and redirects before coding.
