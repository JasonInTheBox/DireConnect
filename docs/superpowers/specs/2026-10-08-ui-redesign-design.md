# DireConnect UI/UX Redesign: Design Spec

Date: 2026-10-08
Scope: `apps/web` only. No changes to `apps/api`, `apps/worker`, `packages/*`, the Prisma schema, or API contracts.

## 1. Goal

Turn the current page-per-route, dark-only frontend into a cohesive, accessible, responsive SaaS interface for non-technical small-business owners. The work is mainly structural (app shell, business context, reusable components, task flows); restyling is secondary.

Success looks like:
- A persistent shell with an always-visible "which business am I managing" switcher.
- Every page built from shared components; no page file over about 150 lines.
- Consistent loading, empty, error and success feedback; no `alert()` or `window.confirm`.
- Campaign creation as a guided flow with preview, validation, SMS counting and a confirmation before sending.
- Keyboard-operable, visible focus, accessible contrast, reduced-motion support, usable at phone width.
- Existing behaviour preserved: auth, business ownership checks (server side), all API calls, existing URLs.

## 2. Non-goals

- No backend, schema or API changes. No new campaign statuses, no trend/time-series data, no profile or settings endpoints.
- No new runtime dependencies (no shadcn/Radix, no TanStack Query, no icon library).
- No navigation entries for features that do not exist (no business-level Analytics, no separate Settings, no communication preferences, no merge fields in messages).
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
- `useApi.ts`: `useApi<T>(path | null)` returns `{ data, error, loading, refetch }`, aborts on unmount (React StrictMode safe).
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

**Customers.** Toolbar: search (name, email, phone), consent filter (All, Email opted in, SMS opted in, Unsubscribed), count, **Add customer**. Add/Edit share a dialog. Columns: Name, Email, Phone, Consent badges, row menu (Edit, Delete with confirm). Client-side pagination beyond 50 rows. Empty states: first customer; no search matches. Skeleton while loading; ErrorState with Retry.

**Dashboard.** Built only from `/dashboard` data. Header with quick actions (Add customer, New campaign). Setup checklist shown only while applicable (add first customer, send first campaign), driven by real counts. Panels: Customers (total plus email opt-in, SMS opt-in, unsubscribed breakdown); Delivery (sent/failed/pending as one stacked bar and the success rate, or "No messages sent yet"); Campaigns (status breakdown); Recent campaigns table. No trend charts. Business details moved to the Businesses page, with an edit link.

**Campaign list.** Table: Name, Channel, Status, Audience, When (scheduled or sent date), Delivery (sent of eligible). Delivery stats are fetched only for non-draft campaigns (today every campaign triggers an analytics request). Statuses: Draft, Queued, Scheduled, Sent, Failed. Rows open the detail view. Draft rows offer Edit, Delete (confirm).

**Campaign wizard** (`/campaigns/new`, `/campaigns/[id]/edit`; step indicator; state preserved when moving between steps):
1. Basics: name, channel (Email or SMS), each with a one-line explanation.
2. Audience: the three audience options in plain language; hint from dashboard counts (for example "12 customers have opted in to SMS"), with a warning when zero.
3. Message: textarea, live preview (SMS bubble or email card). SMS: character count, message parts, warning for non-GSM characters. No merge fields.
4. Review & send: entering this step creates or updates the draft (disclosed on the page) and loads `/preview` for exact eligible and skipped counts with reasons. Choose Send now or Schedule (date must be in the future). The final action opens a confirm dialog: "Send to N customers now? Queued campaigns can't be edited or cancelled." Zero eligible recipients disables sending with an explanation.
- "Save draft" is available at any step once name and message exist and is visually distinct from the send action. Inline validation per step; focus moves to the first invalid field.
- Editing a non-draft campaign is not offered (the API rejects it).

**Campaign detail.** Shared layout: title, status, channel, message, draft-only actions (Edit, Delete, Send) in the header; tabs link to existing routes: Audience, Results, Delivery log. Existing content of those pages is restyled with shared components.

**Auth pages.** Centred layout, real `<label>`s, inline errors replacing `alert()`, loading state. Headings and placeholders required by e2e tests are preserved.

**Account.** Sections: Sign-in (email, read-only), Password (change via `supabase.auth.updateUser`), Session (log out).

## 8. Accessibility

Semantic landmarks and heading order; skip link; visible focus rings on all interactive elements; labelled inputs with error association; native `<dialog>` focus management and Escape; menu and tabs keyboard patterns per WAI-ARIA; toast live region (polite for success, assertive for errors); contrast AA in both themes; status never by colour alone; targets of at least 40px on touch layouts; reduced-motion respected.

## 9. Testing and verification

- Unit/component tests (Vitest) for: SMS character/segment counter, `apiFetch` error handling, schedule/ISO conversion, Dialog/ConfirmDialog behaviour, Field error wiring, and wizard step validation, if the existing Vitest config can run component tests (to confirm in the plan; otherwise logic is extracted into pure functions and tested without a DOM).
- Update `e2e` tests only where selectors change; keep existing ones passing.
- `npm run lint` and `npm run build -w apps/web` must pass.
- Manual/visual check in a browser at 375, 768 and 1280px in light and dark, keyboard-only pass on shell, dialogs and the wizard. Authenticated pages need local Supabase and API environment values; if unavailable, authenticated screens are verified with mocked responses and this limit is stated in the final report.

## 10. Delivery phases (each shippable)

1. Tokens, primitives, data layer, shell, business switcher, auth layouts, landing fix.
2. Businesses and Customers pages.
3. Dashboard.
4. Campaign list and wizard.
5. Campaign detail tabs and Account page.

## 11. Open items to confirm during planning

- Whether the web app can import zod schemas from `packages/validation` for client validation (transpile/build friction); otherwise hand-write matching checks.
- Vitest environment for component tests (jsdom / Testing Library availability).
- Local run requirements (Supabase URL/keys, API URL) for authenticated verification.
- Contrast results for final token values.
- Read the Next.js docs in `node_modules/next/dist/docs/` for layouts, route groups, `params` handling and redirects before coding.
