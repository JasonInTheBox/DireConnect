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
- Also fix: page metadata title "DireConnect" with a real description.

## 5. Architecture

### 5.1 Routes (URLs unchanged unless noted)

```
app/
  layout.tsx                       root: fonts, metadata, globals
  page.tsx                         landing (logged out) / redirect to /businesses (logged in)
  (auth)/login, signup             centred auth layout
  (app)/layout.tsx                 auth guard, providers, shell
  (app)/account/page.tsx           NEW
  (app)/businesses/page.tsx
  (app)/businesses/[businessId]/layout.tsx          selected-business context + 404 state
  (app)/businesses/[businessId]/dashboard
  (app)/businesses/[businessId]/customers
  (app)/businesses/[businessId]/campaigns            list
  (app)/businesses/[businessId]/campaigns/new        NEW wizard
  (app)/businesses/[businessId]/campaigns/[campaignId]/layout.tsx   header + tabs
  (app)/businesses/[businessId]/campaigns/[campaignId]/page.tsx     redirect (Results, or Audience for drafts)
  (app)/businesses/[businessId]/campaigns/[campaignId]/edit         NEW (same wizard, drafts only)
  (app)/businesses/[businessId]/campaigns/[campaignId]/preview      tab "Audience"
  (app)/businesses/[businessId]/campaigns/[campaignId]/analytics    tab "Results"
  (app)/businesses/[businessId]/campaigns/[campaignId]/logs         tab "Delivery log"
```

`app/customers/page.tsx` (redirect to /businesses) is kept. Login success redirects to `/businesses`. Moving files into route groups does not change URLs.

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

- `(app)/layout.tsx`: auth guard (skeleton shell while checking; redirect to `/login` if no session), `ToastProvider`, `BusinessesProvider` (single `GET /api/businesses`), sidebar and main landmark, skip-to-content link.
- Sidebar items, only for existing pages:
  - Workspace: Businesses.
  - Selected business (shown inside a business, headed by its name): Dashboard, Customers, Campaigns.
  - Account: Account; signed-in email and Log out at the foot.
- Active item: `aria-current="page"` plus accent marker.
- BusinessSwitcher: menu button (monogram, name, "Managing"); menu lists businesses with keyboard support (arrows, type-ahead, Escape) and "Create business" (dialog, then navigate to the new dashboard). Switching preserves the section (`/businesses/A/customers` to `/businesses/B/customers`); from campaign detail it goes to the new business's campaign list. Outside a business the button reads "Select a business".
- Selected business is derived from the URL param. If the ID is not in the user's list, show "Business not found" with a link back (server ownership checks unchanged).
- Header: breadcrumbs (Businesses > name > section > item), 20px title, slot for the primary action.
- Responsive: at 1024px and up a full sidebar collapsible to a 64px icon rail (preference in `localStorage`, wrapped in try/catch); below 1024px an off-canvas drawer opened from a top-bar hamburger (reuses Dialog for focus trap and Escape).
- `/` shows a minimal landing for logged-out users (keeping "Log in" and "Sign up" links), redirects logged-in users to `/businesses`; the unused health fetch is removed.

## 7. Pages

**Businesses.** Two-column card grid: monogram, name, clamped description, contact line, **Open**; menu with Edit and Delete (delete requires typing the business name; deletion cascades to customers and campaigns). Current business marked. "New business" opens the shared create/edit dialog. Empty state with a create action.

**Customers.** Toolbar: search (name, email, phone), consent filter (All customers, Opted in to email, Not opted in), count, **Add customer**. Add/Edit share a dialog. Columns: Name, Email, Phone, Email consent badge (Email opted in / Email not opted in), row menu (Edit, Delete with confirm). The form's email consent checkbox is unchecked by default, keeps the wording "Customer explicitly agreed to receive promotional emails", and has helper text explaining that only customers who agreed can receive campaigns. SMS consent is not a primary control (SMS is paused): the form passes the existing `smsOptIn` value through unchanged on edit so it is never overwritten, and a small "SMS opted in" badge appears only for customers who have it. Client-side pagination beyond 50 rows. Empty states: first customer; no search matches. Skeleton while loading; ErrorState with Retry.

**Dashboard.** Built only from `/dashboard` data. Header with quick actions (Add customer, New campaign). Setup checklist shown only while applicable (add first customer, send first campaign), driven by real counts. Panels: Customers (total plus email opt-in, SMS opt-in, unsubscribed breakdown); Delivery (sent/failed/pending as one stacked bar and the success rate, or "No messages sent yet"); Campaigns (status breakdown); Recent campaigns table. No trend charts. Business details moved to the Businesses page, with an edit link.

**Campaign list.** Table: Name, Channel, Status, When (scheduled or sent date), Delivery (sent of eligible). The audience column is dropped (it carries no information for email). Delivery stats are fetched only for non-draft campaigns (today every campaign triggers an analytics request). Statuses: Draft, Queued ("Waiting to be sent"), Scheduled, Sent, Failed. Legacy SMS campaigns show an "SMS" badge and the note "SMS sending is paused"; they offer View and, for drafts, Delete only (no Edit or Send). Rows open the detail view. Email draft rows offer Edit, Delete (confirm).

**Campaign wizard** (`/campaigns/new`, `/campaigns/[id]/edit`; step indicator; state preserved when moving between steps):
1. Basics: campaign name. A fixed "Email" channel label explains that campaigns are sent by email; no channel choice is offered.
2. Recipients: explains in plain language who receives the campaign (customers who agreed to receive promotional emails, have an email address, and have not unsubscribed). Shows the opted-in count from the dashboard endpoint, a warning if it is zero with a link to add customers, and the launch limits from `CAMPAIGN_EMAIL_SAFETY_LIMITS` ("up to 10 recipients per campaign; each customer can receive one campaign email per 24 hours"). No audience selector.
3. Message: textarea and a live email preview card (subject is the campaign name; the unsubscribe footer is shown as a note). Character count is informational only. No merge fields.
4. Review & send: entering this step creates or updates the draft (disclosed on the page) and loads `/preview` for exact eligible and skipped counts with reasons. Choose Send now or Schedule (the date must be in the future). Blocking states, each with a plain-language explanation and no send button:
   - zero eligible recipients;
   - more than 10 eligible recipients (the message states the limit and the current count);
   - signed-in email not confirmed (read from the Supabase user; links to Account).

   The final action opens a confirm dialog: "Send to N customers now? Queued campaigns can't be edited or cancelled." If the API still answers 403 (for example "Campaign sending is not enabled for this account.") or 409, the server's message is shown in a persistent inline panel on the Review step, not only a toast, and the draft is kept. After a successful queue the user lands on the campaign's Results tab with a success toast; the tab copy notes that delivery happens in the background and that per-day sending limits may mark some recipients as failed.
- "Save draft" is available at any step once name and message exist and is visually distinct from the send action. Inline validation per step; focus moves to the first invalid field.
- Editing a non-draft or SMS campaign is not offered (the API rejects it). Visiting `/edit` for such a campaign shows an explanation and a link back.
- Schedule values are sent as ISO timestamps; the Review step states the time zone used for display.

**Campaign detail.** Shared layout: title, status, channel, message, draft-only actions (Edit, Delete, Send) in the header; tabs link to existing routes: Audience, Results, Delivery log. Existing content of those pages is restyled with shared components. The Delivery log shows each recipient's status and the failure reason in plain text (including the per-day sending-limit reasons), with a short legend explaining the limits. Draft-only actions are hidden for SMS campaigns.

**Auth pages.** Centred layout, real `<label>`s, inline errors replacing `alert()`, loading state. Headings and placeholders required by e2e tests are preserved.

**Account.** Sections: Sign-in (email, read-only), Password (change via `supabase.auth.updateUser`), Session (log out).

## 8. Accessibility

Semantic landmarks and heading order; skip link; visible focus rings on all interactive elements; labelled inputs with error association; native `<dialog>` focus management and Escape; menu and tabs keyboard patterns per WAI-ARIA; toast live region (polite for success, assertive for errors); contrast AA in both themes; status never by colour alone; targets of at least 40px on touch layouts; reduced-motion respected.

## 9. Testing and verification

- Vitest runs in the `node` environment with no DOM or Testing Library, and this redesign adds no test dependencies. Logic is therefore extracted into pure functions and unit-tested in Node: `apiFetch` error mapping and the slow-response timing, local-time/ISO schedule conversion, wizard step validation, send-blocking rules (zero recipients, over the limit, unconfirmed email), SMS-legacy display rules, status derivation (Draft / Queued / Scheduled / Sent / Failed), and customer filtering/search.
- Component behaviour (dialogs, focus, wizard flow, switcher) is checked with Playwright, which is already in the repo, using mocked network responses for the API and Supabase session. Keep the existing e2e tests passing; update selectors only where they change.
- `npm run lint` and `npm run build -w apps/web` must pass.
- Manual/visual check in a browser at 375, 768 and 1280px in light and dark, keyboard-only pass on shell, dialogs and the wizard. Authenticated pages need local Supabase and API environment values; if unavailable, authenticated screens are verified with mocked responses and this limit is stated in the final report.

## 10. Delivery phases (each shippable)

1. Tokens, data layer, the primitives the shell needs (Button, Field, Dialog, Menu, Toast, Skeleton, EmptyState/ErrorState, Icon), app shell, business switcher, auth pages, landing fix. Remaining primitives (Select, Checkbox, ConfirmDialog, Table, Tabs, Badge/StatusBadge, PageHeader, Breadcrumbs) are added in the phase that first uses them.
2. Businesses and Customers pages. The customer table appears at lg and above and stacks into cards below; the Businesses page reads the shared businesses list.
3. Dashboard.
4. Campaign list and wizard.
5. Campaign detail tabs and Account page.

## 11. Open items to confirm during planning

- Whether the web app can import `CAMPAIGN_EMAIL_SAFETY_LIMITS` and the zod schemas from `@direconnect/validation` (needs a workspace dependency in `apps/web` and the package built first; the old Amplify build did this). Importing the limits is preferred over hard-coding them so the UI cannot drift from the API; if it adds friction, mirror the constants with a comment pointing at the source.
- How to mock the Supabase browser session in Playwright (seeding its storage key or intercepting auth calls).
- Local run requirements (Supabase URL/keys, API URL) for authenticated verification against real data.
- Contrast results for final token values.
- Read the Next.js docs in `node_modules/next/dist/docs/` for layouts, route groups, `params` handling and redirects before coding.
