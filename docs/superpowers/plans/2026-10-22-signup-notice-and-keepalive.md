# Sign-up Notice and Keep-alive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Tell visitors clearly that DireConnect is a non-commercial project that is not creating new accounts, and make the sign-up form handle Supabase's "sign-ups disabled" state gracefully; (2) keep the Supabase database (and the Supabase project as a whole) and Redis from being paused or deleted for inactivity, with a protected API endpoint that touches all three and a scheduled GitHub Actions workflow that calls it.

**Architecture:** (1) The web app asks Supabase's public settings endpoint whether sign-ups are disabled, so the notice follows the real Supabase toggle with no env flag to keep in sync; failures fall back to showing the form, and Supabase's `signup_disabled` error code is mapped to the same notice. (2) `GET /api/keepalive` (bearer token from `KEEPALIVE_TOKEN`, disabled when unset) runs a real DB query, a Redis `PING` + `SET`, and an HTTP request to Supabase Auth, each with a timeout, and answers 200 only if all three succeed. A daily scheduled workflow calls it with retries (the Render API may be asleep) and fails loudly so GitHub emails the owner when something is wrong.

**Tech Stack:** Next.js 15.5 / React 19 / TypeScript / Tailwind (web), Express + Prisma + BullMQ/ioredis (API), Vitest + supertest, Playwright, GitHub Actions. No new dependencies.

## Global Constraints

- Scope: `apps/web`, `apps/api`, `e2e/`, `.github/workflows/`, docs/plans. No changes to `apps/worker`, `packages/*` (except if a shared helper is truly needed), the Prisma schema, or existing API contracts. No new dependencies.
- Never print, log or commit secrets. The keep-alive token is only ever read from `process.env.KEEPALIVE_TOKEN`; error details from Prisma/Redis/fetch are logged server-side only and never returned to the caller.
- Web conventions (from the redesign): colours only from token utilities (`text-muted`, `bg-sunken`, `border-line`, `text-ink`, `bg-accent`, ...); 14px body; sentence case; JSX text must not contain raw `'` or `"` (use `’`); touch targets >= 40px (`buttonClasses`); every page renders its own `<title>` through `AuthCard`/`PageHeader` (never add a root metadata title or `document.title` effects); status never by colour alone; effect-driven focus (no `requestAnimationFrame`).
- `Button` with `loading` uses `aria-disabled`/`aria-busy` (not `disabled`).
- Playwright: prefer role-based locators; the Supabase and API are mocked in `e2e/helpers/app.ts` (`mockApi` registers a catch-all for `https://example.supabase.co/**` handling `/auth/v1/*` routes and records `state.authRequests`); Playwright runs modify tracked-looking output dirs only if tracked (they are now git-ignored).
- `apps/api/src/routes/campaign.test.ts` fails on a clean checkout when a stale git-ignored `apps/api/src/config/env.js` exists; never touch that file. Expect that one failing file in `npm test` if it fails for that reason.
- Work on branch `feat/signup-notice-and-keepalive` (already checked out). Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` verbatim. Do NOT push (the owner pushes and opens the pull request).
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` (Git Bash syntax).

## Facts relied on

- Supabase Auth exposes a public `GET {SUPABASE_URL}/auth/v1/settings` (header `apikey: <publishable key>`) that returns JSON including `disable_signup: boolean`. `signUp` on a project with sign-ups disabled returns an `AuthApiError` with `code: "signup_disabled"` (status 422).
- Supabase pauses free projects after a period without activity; Redis providers on free tiers also archive idle databases. Real queries/commands are the safe signal, so the endpoint performs a real query (`SELECT 1` through Prisma), a Redis write with TTL, and a request to Supabase Auth.
- The API is on Render's free tier (sleeps after ~15 min idle; a cold start can take about a minute), so the workflow must retry with a long timeout.
- `campaignQueue` (BullMQ `Queue` in `apps/api/src/lib/campaignQueue.ts`) owns an ioredis connection; `await campaignQueue.client` yields the ioredis client.
- The API's existing routers take injectable dependencies (`createXRouter(db, ...)`) so tests use fakes; follow that pattern.

---

### Task 1: Sign-up closed notice (web)

**Files:**
- Create: `apps/web/src/lib/signupStatus.ts`, `apps/web/src/lib/signupStatus.test.ts`, `apps/web/src/lib/useSignupStatus.ts`, `apps/web/src/components/auth/signup-closed-notice.tsx`, `e2e/signup-closed.spec.ts`
- Modify: `apps/web/src/app/(auth)/signup/page.tsx`, `apps/web/src/app/(auth)/login/page.tsx`, `apps/web/src/app/page.tsx`, `e2e/helpers/app.ts` (Supabase mock: `GET /auth/v1/settings` and a `signUp` route), `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (Auth pages paragraph)

**Interfaces:**
- Produces: `parseSignupSettings(body: unknown): "open" | "closed" | "unknown"`; `isSignupDisabledError(error: unknown): boolean`; `SIGNUP_CLOSED_TITLE`, `SIGNUP_CLOSED_TEXT` constants; `useSignupStatus(): "checking" | "open" | "closed"`; `<SignupClosedNotice />`.

- [ ] **Step 1: Failing unit tests** in `apps/web/src/lib/signupStatus.test.ts`:
  - `parseSignupSettings({ disable_signup: true })` is `"closed"`; `{ disable_signup: false }` is `"open"`; `{}`, `null`, a string, `{ disable_signup: "yes" }` are `"unknown"`.
  - `isSignupDisabledError({ code: "signup_disabled", status: 422 })` is true; `{ code: "weak_password" }`, `{ message: "Signups not allowed for this instance" }` (no code) is **true** (older GoTrue sends only the message; match `/signups? not allowed/i`), `null` and a string are false.
  Run `npx vitest run apps/web/src/lib/signupStatus.test.ts`: FAIL.

- [ ] **Step 2: Implement** `signupStatus.ts` with the two pure functions and exported copy constants:
  - `SIGNUP_CLOSED_TITLE = "Sign-up is closed"`
  - `SIGNUP_CLOSED_TEXT = "DireConnect is a non-commercial project, so new accounts aren’t being created right now. If you already have an account, you can log in."`
  Then `useSignupStatus.ts` (client hook): on mount `fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal })` with a 5 s abort timeout and unmount abort; map the parsed JSON through `parseSignupSettings`; any failure (network, non-2xx, bad JSON, `"unknown"`) yields `"open"` (the form stays usable; the error mapping below is the backstop). Return `"checking"` until settled. StrictMode-safe (abort in cleanup; ignore aborted results).
  Verify unit tests pass.

- [ ] **Step 3: The notice component** `signup-closed-notice.tsx`: a `role="note"` panel using tokens (`rounded-container border border-line bg-sunken px-4 py-3 text-sm`), a bold `SIGNUP_CLOSED_TITLE` line (`font-medium text-ink`) and `SIGNUP_CLOSED_TEXT` (`text-muted`), plus an info icon from the existing icon set if one fits (otherwise text only); never colour alone.

- [ ] **Step 4: Wire it in**
  - **Signup page:** call `useSignupStatus()`; when `closed` OR when `signUp` returns an error for which `isSignupDisabledError` is true (set local `closedByError` state), render `<AuthCard title="Sign-up is closed" subtitle=...>` containing `<SignupClosedNotice />` and a primary `Link` "Go to log in" (same title string must be a real AuthCard title so the page `<title>` becomes "Sign-up is closed · DireConnect"); otherwise render the existing form unchanged (including while `checking`). Do not show the raw Supabase message for the disabled case.
  - **Login page footer:** when `closed`, replace "Don’t have an account? Sign up" with "New accounts aren’t being created right now."; otherwise unchanged.
  - **Landing page:** when `closed`, show `<SignupClosedNotice />` under the buttons and drop the "Sign up" button (keep "Log in"); otherwise unchanged. Keep the `<title>`.
  - Titles/h1: the landing page `<h1>` and `<title>` stay as they are.

- [ ] **Step 5: E2E mock + tests.** In `e2e/helpers/app.ts` add an option `signupsDisabled?: boolean` and handle in the Supabase mock: `GET /auth/v1/settings` returns `{ external: { email: true }, disable_signup: Boolean(options.signupsDisabled), mailer_autoconfirm: false }`; `POST /auth/v1/signup` returns 422 `{ code: 422, error_code: "signup_disabled", msg: "Signups not allowed for this instance" }` when `signupsDisabled`, otherwise a 200 user with no session (confirmation required), recorded in `state.authRequests`. Create `e2e/signup-closed.spec.ts` (use `mockApi(page, { businesses: [], signupsDisabled: true })`, no sign-in):
  1. `/signup` shows the heading "Sign-up is closed", the exact notice text, a "Go to log in" link to `/login`, **no** email/password fields and no `/auth/v1/signup` request; page title is "Sign-up is closed · DireConnect".
  2. `/` shows the notice and no "Sign up" link, still has "Log in".
  3. `/login` footer says "New accounts aren’t being created right now." and has no "Sign up" link.
  4. With `signupsDisabled: false` (default): `/signup` still shows the form; `/` still has both links (regression guard).
  5. Settings request fails (route abort of `/auth/v1/settings`, sign-ups actually disabled so the signUp call returns `signup_disabled`): the form shows at first, and after submitting valid values the closed notice replaces it (error mapping backstop); no raw "Signups not allowed" text anywhere.
  Existing `e2e/auth.spec.ts`, `home.spec.ts` and `page-titles.spec.ts` must still pass unchanged (their Supabase host is not reachable → "open").

- [ ] **Step 6: Spec.** Edit the Auth pages paragraph of `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` in place: sign-up checks Supabase's public settings; when closed, the landing, login and sign-up pages say DireConnect is a non-commercial project not creating new accounts; if the settings request fails the form stays and a `signup_disabled` error shows the same notice.

- [ ] **Step 7: Verify** `npx tsc --noEmit -p apps/web`, `npm run lint -w apps/web` (0 errors), `npx vitest run apps/web`, `npx playwright test` (full suite; clean any generated output with `git clean -fdq playwright-report test-results`), then commit:

```bash
git add apps/web e2e docs
git commit -m "feat(web): tell visitors sign-up is closed and handle Supabase's disabled sign-ups

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Keep-alive endpoint and scheduled workflow

**Files:**
- Create: `apps/api/src/routes/keepalive.ts`, `apps/api/src/routes/keepalive.test.ts`, `.github/workflows/keepalive.yml`
- Modify: `apps/api/src/app.ts` (mount the router), `.env.example`, `apps/api/.env.example`, the deployment docs (`docs/DEPLOYMENT.md` if present, otherwise `DEPLOYMENT.md`/`README.md`: add a "Keeping services awake" section)

**Interfaces:**
- Produces: `createKeepaliveRouter(deps?: { db?, getRedis?, fetchImpl?, token?, supabaseUrl?, supabaseKey?, timeoutMs?, now? })`, `keepaliveRouter`; route `GET /api/keepalive`.

- [ ] **Step 1: Failing tests** `apps/api/src/routes/keepalive.test.ts` (mirror how `campaign.test.ts`/`customer.test.ts` build an express app with an injected router and use supertest; read one first). Cover:
  - token unset: 404 and no dependency is called (the endpoint is disabled).
  - missing or wrong bearer token: 401, no dependency called; correct token with `Authorization: Bearer <token>`: continues (timing-safe comparison, also works for tokens of different length without throwing).
  - all three succeed: 200 `{ status: "ok", checks: { database: "ok", redis: "ok", supabase: "ok" }, timestamp }`; the DB check ran a raw query; Redis `ping` and a `set` with an expiry (a key like `keepalive:last`) were called; the Supabase fetch went to `<supabaseUrl>/auth/v1/settings` with the `apikey` header.
  - each dependency failing on its own (DB rejects, Redis rejects, fetch rejects, fetch returns non-2xx): 503 with `status: "degraded"` and only that check `"failed"`, the others still reported; the response body never contains error messages, stack traces, URLs or the token; the error is logged via `console.error` (spy).
  - a dependency that never resolves times out (use a tiny `timeoutMs` such as 20 ms) and is reported `"failed"` without hanging the request.
  - checks run independently (one failing does not skip the others).
  Run: FAIL (module missing).

- [ ] **Step 2: Implement** `keepalive.ts`:
  - Default deps: `db = prisma` (from `@direconnect/db`), `getRedis = () => campaignQueue.client` (import from `../lib/campaignQueue.js`), `fetchImpl = fetch`, `token = process.env.KEEPALIVE_TOKEN`, `supabaseUrl = process.env.SUPABASE_URL`, `supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY`, `timeoutMs = 10_000`. **Do not import `campaignQueue` at module top-level in a way that breaks the tests** if it connects to Redis on import: the existing routers already import it, so follow `campaign.ts`'s injection pattern (default parameter) and have the tests inject a fake.
  - Token check with `crypto.timingSafeEqual` on equal-length buffers (hash both sides with SHA-256 first so lengths always match). No token configured: `res.status(404).json({ error: "Not found" })`.
  - Checks: database `await db.$queryRaw\`SELECT 1\``; redis `const client = await getRedis(); await client.ping(); await client.set("keepalive:last", now().toISOString(), "EX", 60 * 60 * 24 * 14)`; supabase `fetchImpl(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey }, signal })` and require `response.ok`. Each wrapped in `withTimeout` (reject after `timeoutMs`, clear the timer). Run them with `Promise.allSettled`.
  - Response: 200 `ok` when all pass else 503 `degraded`. Log failures with `console.error("keepalive check failed", name, error)` (the error object only goes to the server log). Never include dependency error text in the response.
  - Mount in `app.ts`: `app.use("/api/keepalive", keepaliveRouter);` placed before the other routers' auth middleware concerns (it has its own token auth; it must not require a Supabase user). Add `Authorization` is already an allowed CORS header; no CORS change needed (called server-to-server).
  - Make the tests pass.

- [ ] **Step 3: Env docs.** Add to `.env.example` and `apps/api/.env.example`:
  ```
  # Shared secret for GET /api/keepalive (daily GitHub Actions ping). Generate a long random value;
  # leave empty to disable the endpoint. Set the same value as the KEEPALIVE_TOKEN repository secret.
  KEEPALIVE_TOKEN=
  ```

- [ ] **Step 4: Workflow** `.github/workflows/keepalive.yml`:
  - `on: schedule: - cron: "17 5 * * *"` (daily; an off-the-hour minute) and `workflow_dispatch`.
  - One job `ping` on `ubuntu-latest`, `timeout-minutes: 10`, `permissions: {}` (it needs no repo access), no checkout.
  - Env from `secrets.KEEPALIVE_TOKEN` and `vars.KEEPALIVE_API_URL` (the API origin, e.g. `https://api.example.com`, no trailing slash).
  - Step 1 "Check configuration": fail with a clear `::error::` message when either is empty (do not silently skip).
  - Step 2 "Ping": `curl --silent --show-error --fail-with-body --retry 5 --retry-delay 30 --retry-all-errors --max-time 120 --header "Authorization: Bearer ${KEEPALIVE_TOKEN}" "${KEEPALIVE_API_URL%/}/api/keepalive"`; make sure the token is never echoed (no `set -x`, pass through env only). Print the JSON response (it contains no secrets).
  - A comment block at the top explaining: why it exists, the two settings to add (secret `KEEPALIVE_TOKEN`, variable `KEEPALIVE_API_URL`), that scheduled workflows run only on the default branch and GitHub pauses them after 60 days without repository activity (re-enable in the Actions tab), and that a failing run emails the repo owner.
  Validate the YAML parses (e.g. `node -e` with a tiny parser is unavailable; run `npx --yes js-yaml` is NOT allowed (no new deps); instead check indentation carefully and, if `actionlint` is not available, say so).

- [ ] **Step 5: Deployment docs.** Add a "Keeping services awake" section to the deployment doc: what is pinged and why, the exact steps (generate a token with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, set `KEEPALIVE_TOKEN` in the Render API environment, add the repository secret `KEEPALIVE_TOKEN` and variable `KEEPALIVE_API_URL`, run the workflow once via "Run workflow" and read the log), how to read a failure (`checks` object), and a note that this covers Supabase and Redis; the Render API wakes up as a side effect; Railway worker is separate.

- [ ] **Step 6: Verify** `npx vitest run apps/api` (new tests green; if `campaign.test.ts` fails for the known stale `env.js` reason, say so and confirm it fails identically on a clean `origin/main`), `npm run build -w apps/api` (type-check the API), `npm test` at the repo root, and confirm `git status` shows no secrets or generated output. Commit:

```bash
git add apps/api .github .env.example docs README.md DEPLOYMENT.md
git commit -m "feat(api): add a protected keep-alive endpoint and a daily workflow that pings Supabase and Redis

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(adapt the `git add` paths to the files that actually changed.)

---

## Self-review

- Coverage: sign-up closed (landing, login, sign-up, error backstop, spec) = Task 1; DB, Redis and Supabase pings, auth, workflow, secrets handling, docs = Task 2.
- No placeholders; copy strings and routes are exact.
- Consistency: `SIGNUP_CLOSED_TITLE` is used as the AuthCard title; `createKeepaliveRouter` deps mirror the repo's router-injection pattern.
