# DireConnect UI Redesign, Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the design tokens, data layer, core UI primitives, authenticated app shell (sidebar, business switcher, mobile drawer), redesigned auth pages and landing page, without changing any backend behaviour.

**Architecture:** An `(app)` route group wraps all authenticated routes in one layout (toasts, session guard, businesses provider, shell). A nested business layout resolves the selected business from the URL. Pure logic (API client, navigation rules, menu keyboard maths, storage) lives in `src/lib` and is unit-tested in Node; React primitives live in `src/components/ui`; shell pieces in `src/components/shell`. Existing pages are moved into the group unchanged apart from `<main>` becoming `<div>`, so they keep working until their own phase.

**Tech Stack:** Next.js 15.5 (App Router), React 19.2, TypeScript, Tailwind CSS v4, Supabase JS 2.108, Vitest (node environment), Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (revised 2026-10-10). This is plan 1 of 5, one per spec phase. Plans for phases 2-5 (Businesses and Customers, Dashboard, Campaign list and wizard, Campaign detail and Account) are written after this phase lands, because they consume the exact primitive APIs created here.

## Global Constraints

- Scope is `apps/web` plus `e2e/` and the spec/plan docs. No changes to `apps/api`, `apps/worker`, `packages/*`, Prisma schema, or API contracts.
- No new runtime or dev dependencies (no shadcn/Radix, TanStack Query, icon library, jsdom, Testing Library).
- Light theme by default; dark theme follows `prefers-color-scheme`; no manual toggle.
- Colour tokens (light / dark): canvas `#F6F7F8` / `#0E1113`; surface `#FFFFFF` / `#15191C`; line `#E3E6EA` / `#262C31`; ink `#14181F` / `#E8EBED`; muted `#5B6572` / `#98A2AB`; accent `#0B6E73` / `#4DB6BC`; accent-soft `#E2F1F1` / `#12292B`. Success text uses `#17703F` and warning text uses `#8A5B00` in light (adjusted from the spec's `#1A7F4B` / `#9A6700` because those failed AA on their soft backgrounds). Every text/background pair used must reach 4.5:1 in both themes (enforced by a test).
- Typography: Geist; body 14px; sentence case; no all-caps labels; no monospace labels.
- Radius 6px (controls) and 10px (containers, dialogs); borders for separation; shadow only on floating layers; motion 120-160ms and only in response to a user action; `prefers-reduced-motion: reduce` disables transitions and animations.
- Status and meaning are never conveyed by colour alone.
- Touch layouts: interactive controls at least 40px tall (`h-10`), 36px (`lg:h-9`) at desktop widths.
- Copy: active voice, sentence case, the same verb for button and resulting toast ("Create business" gives "Business created"). Errors state what happened and how to fix it; no apologies.
- Existing e2e expectations must keep passing: home page links named "Log in" and "Sign up" (one of each); login page heading "Log in" and placeholders `you@example.com` and `Your password`.
- The 90-second API timeout and the "Waking up the server" notice after 4 seconds exist because the Render free API sleeps when idle.
- JSX text must not contain raw `'` or `"` characters (lint rule `react/no-unescaped-entities`); use `’` or a string expression.
- The sidebar lists only pages that exist. The spec's "Account" link is added in phase 5 together with the Account page; until then the sidebar footer shows the signed-in email and a Log out button.
- Work on branch `ui-redesign`, not `main`. Commit messages end with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- All commands run from the repository root `C:\Users\Junjie Liu\Desktop\DireConnect` unless stated (Git Bash syntax).

## Baseline (recorded 2026-10-10, before any change)

- `npx vitest run`: 10 files pass (47 tests), 1 file fails: `apps/api/src/routes/campaign.test.ts` with `Missing required environment variable: SUPABASE_JWT_SECRET`. Cause: a stale, git-ignored compiled `apps/api/src/config/env.js` shadows `env.ts`. **Not part of this work**; do not edit or delete it. Expected result after every task: the same single failure, plus all new tests passing.
- `npm run lint -w apps/web`: 0 errors, 7 warnings (react-hooks/exhaustive-deps in six legacy pages, unused `Image` in `app/page.tsx`).
- `NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web`: succeeds.
- Playwright chromium is installed. If a run reports a missing browser: `npx playwright install chromium`.
- `apps/web/AGENTS.md` points to `node_modules/next/dist/docs/`, which does not exist in the installed Next 15.5.19. Behaviour is verified by the build and e2e tests instead.

## Review Focus

Failure modes the spec implies but a happy-path build would miss, each pinned by a test in the owning task:

1. A business ID in the URL that does not belong to the user shows "Business not found" with a way back, not a blank page or the legacy page (Task 11 e2e).
2. A brand-new account with zero businesses sees "Create your first business" in the switcher and can still reach `/businesses` (Task 11 e2e).
3. A slow or sleeping API shows "Waking up the server" and does not show an error before 90 seconds (Task 2 timeout unit test; Task 11 e2e).
4. A 401 from the API, or a missing session, sends the user to `/login` and never calls the API without a token (Task 2 unit tests).
5. `localStorage` being unavailable or throwing must not break the sidebar (Task 4 unit tests).

---

### Task 1: Branch, design tokens, fonts and metadata

**Files:**
- Create: `apps/web/src/app/tokens.test.ts`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-canvas`, `bg-surface`, `bg-sunken`, `border-line`, `border-line-strong`, `text-ink`, `text-muted`, `bg-accent`, `bg-accent-hover`, `text-accent`, `text-accent-ink`, `bg-accent-soft`, `text-success`, `bg-success-soft`, `text-warning`, `bg-warning-soft`, `text-danger`, `bg-danger-soft`, `border-danger`, `rounded-control` (6px), `rounded-container` (10px), `shadow-float`. Later tasks use only these names.

- [ ] **Step 1: Create the branch and commit the approved spec and this plan**

```bash
git switch -c ui-redesign
git add docs/superpowers/specs/2026-10-08-ui-redesign-design.md docs/superpowers/plans/2026-10-10-ui-redesign-phase-1-foundation.md
git commit -m "docs: revise UI redesign spec and add phase 1 plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

Expected: branch `ui-redesign` created, commit succeeds.

- [ ] **Step 2: Write the failing token test**

Create `apps/web/src/app/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./globals.css", import.meta.url)),
  "utf8",
);

function parseTokens(block: string | undefined): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of (block ?? "").matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

const light = parseTokens(css.match(/:root\s*\{([^}]*)\}/)?.[1]);
const dark = parseTokens(
  css.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1],
);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

// [foreground token, background token] pairs used by the UI for text.
const textPairs: Array<[string, string]> = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["muted", "canvas"],
  ["muted", "surface"],
  ["muted", "sunken"],
  ["accent-ink", "accent"],
  ["accent", "surface"],
  ["accent", "canvas"],
  ["accent", "accent-soft"],
  ["success", "success-soft"],
  ["success", "surface"],
  ["warning", "warning-soft"],
  ["warning", "surface"],
  ["danger", "danger-soft"],
  ["danger", "surface"],
];

describe("design tokens", () => {
  it("defines the same tokens for light and dark", () => {
    expect(Object.keys(light).length).toBeGreaterThan(10);
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [name, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    for (const [foreground, background] of textPairs) {
      it(`${name}: ${foreground} on ${background} meets WCAG AA (4.5:1)`, () => {
        expect(
          contrast(tokens[foreground], tokens[background]),
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("no longer overrides the Geist font with Arial", () => {
    expect(css).not.toMatch(/Arial/i);
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run apps/web/src/app/tokens.test.ts`
Expected: FAIL (the current `globals.css` has no token set, and still contains `Arial`).

- [ ] **Step 4: Replace `globals.css`**

Overwrite `apps/web/src/app/globals.css` with:

```css
@import "tailwindcss";

/* Design tokens. Light is the default; dark follows the OS setting. */
:root {
  --canvas: #f6f7f8;
  --surface: #ffffff;
  --sunken: #eef0f2;
  --line: #e3e6ea;
  --line-strong: #cbd1d8;
  --ink: #14181f;
  --muted: #5b6572;
  --accent: #0b6e73;
  --accent-hover: #095a5e;
  --accent-ink: #ffffff;
  --accent-soft: #e2f1f1;
  --success: #17703f;
  --success-soft: #e4f4eb;
  --warning: #8a5b00;
  --warning-soft: #fbf1d9;
  --danger: #c02a2a;
  --danger-soft: #fbe7e7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --canvas: #0e1113;
    --surface: #15191c;
    --sunken: #0b0d0f;
    --line: #262c31;
    --line-strong: #3a424a;
    --ink: #e8ebed;
    --muted: #98a2ab;
    --accent: #4db6bc;
    --accent-hover: #6cc7cc;
    --accent-ink: #06292b;
    --accent-soft: #12292b;
    --success: #5bc58a;
    --success-soft: #12281c;
    --warning: #e0b04a;
    --warning-soft: #2b2310;
    --danger: #f08080;
    --danger-soft: #2e1616;
  }
}

@theme inline {
  --color-canvas: var(--canvas);
  --color-surface: var(--surface);
  --color-sunken: var(--sunken);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-ink: var(--accent-ink);
  --color-accent-soft: var(--accent-soft);
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);

  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;

  --radius-control: 6px;
  --radius-container: 10px;

  --shadow-float: 0 8px 24px rgb(20 24 31 / 0.14), 0 1px 3px rgb(20 24 31 / 0.1);
}

@layer base {
  body {
    background: var(--canvas);
    color: var(--ink);
    font-size: 14px;
    line-height: 1.5;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Update metadata in `layout.tsx`**

In `apps/web/src/app/layout.tsx`, replace the `metadata` export with:

```ts
export const metadata: Metadata = {
  title: { default: "DireConnect", template: "%s · DireConnect" },
  description:
    "Keep your customer list and send email campaigns to the people who asked to hear from you.",
};
```

- [ ] **Step 6: Run the token test and confirm it passes**

Run: `npx vitest run apps/web/src/app/tokens.test.ts`
Expected: PASS (all contrast pairs in both themes, key parity, no Arial).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/src/app/tokens.test.ts
git commit -m "feat(web): add design tokens, fix font override and metadata" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API client with error handling

**Files:**
- Create: `apps/web/src/lib/apiClient.ts`
- Test: `apps/web/src/lib/apiClient.test.ts`

**Interfaces:**
- Consumes: `apiUrl(path: string): string` from `./api`; `supabase` from `./supabase`.
- Produces:
  - `class ApiError extends Error { status: number; details: unknown }` (`status` is `0` for network and timeout failures).
  - `apiFetch<T = unknown>(path: string, options?: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal }): Promise<T>`
  - `fieldErrorsFromApiError(error: unknown): Record<string, string>`
  - `API_TIMEOUT_MS: number` (90000)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/apiClient.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { supabase } from "./supabase";
import {
  API_TIMEOUT_MS,
  ApiError,
  apiFetch,
  fieldErrorsFromApiError,
} from "./apiClient";

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMock = vi.fn();
const assign = vi.fn();

function signedIn() {
  getSession.mockResolvedValue({
    data: { session: { access_token: "token-123" } },
    error: null,
  } as never);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiFetch", () => {
  it("sends the bearer token and parses JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: "b1" }]));

    const result = await apiFetch<Array<{ id: string }>>("/api/businesses");

    expect(result).toEqual([{ id: "b1" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/businesses");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-123");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("sends a JSON body with a content type", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "new" }));

    await apiFetch("/api/businesses", { method: "POST", body: { name: "Cafe" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Cafe" }));
  });

  it("returns undefined for 204 responses", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiFetch("/api/businesses/b1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the server message", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Business not found" }));

    await expect(apiFetch("/api/businesses/x/dashboard")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Business not found",
    });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502).",
    });
  });

  it("reports an unexpected non-JSON success response", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 200,
      message: "The server sent an unexpected response.",
    });
  });

  it("sends the user to /login on a 401", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does not call the API without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null } as never);

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("turns a network failure into a readable error", async () => {
    signedIn();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    });
  });

  it("waits up to the timeout, then reports a slow server", async () => {
    vi.useFakeTimers();
    signedIn();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const pending = apiFetch("/api/businesses");
    const assertion = expect(pending).rejects.toMatchObject({
      status: 0,
      message: "The server took too long to respond. Try again in a moment.",
    });

    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS - 1);
    // Still pending one millisecond before the timeout: a cold start is not an error.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it("lets a caller cancellation propagate as an AbortError", async () => {
    signedIn();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const controller = new AbortController();

    const pending = apiFetch("/api/businesses", { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await assertion;
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe("fieldErrorsFromApiError", () => {
  it("maps validation issues to the first message per field", () => {
    const error = new ApiError(400, "Invalid request body", [
      { path: ["email"], message: "Invalid email" },
      { path: ["email"], message: "Second message ignored" },
      { path: ["name"], message: "Business name is required" },
      { path: [], message: "No field" },
    ]);

    expect(fieldErrorsFromApiError(error)).toEqual({
      email: "Invalid email",
      name: "Business name is required",
    });
  });

  it("returns an empty object for other errors", () => {
    expect(fieldErrorsFromApiError(new Error("boom"))).toEqual({});
    expect(fieldErrorsFromApiError(new ApiError(500, "Server error"))).toEqual({});
    expect(fieldErrorsFromApiError(undefined)).toEqual({});
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

Run: `npx vitest run apps/web/src/lib/apiClient.test.ts`
Expected: FAIL (`./apiClient` does not exist).

- [ ] **Step 3: Implement `apiClient.ts`**

Create `apps/web/src/lib/apiClient.ts`:

```ts
import { apiUrl } from "./api";
import { supabase } from "./supabase";

/** The Render free API can take about a minute to wake up, so wait well past that. */
export const API_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    details?: unknown;
  } | null;
  const message =
    typeof body?.error === "string" && body.error
      ? body.error
      : `Request failed (${response.status}).`;

  return new ApiError(response.status, message, body?.details);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirectToLogin();
    throw new ApiError(401, "You need to log in to continue.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  try {
    const hasBody = options.body !== undefined;
    const response = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError(401, "Your session has expired. Log in again.");
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(response.status, "The server sent an unexpected response.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (timedOut) {
      throw new ApiError(0, "The server took too long to respond. Try again in a moment.");
    }
    if (options.signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

/** Maps the API's zod validation issues (`details`) to `{ fieldName: message }`. */
export function fieldErrorsFromApiError(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of error.details as Array<{ path?: unknown[]; message?: unknown }>) {
    const field = issue?.path?.[0];
    if (
      typeof field === "string" &&
      typeof issue.message === "string" &&
      !(field in fieldErrors)
    ) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
```

- [ ] **Step 4: Run and confirm it passes**

Run: `npx vitest run apps/web/src/lib/apiClient.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/apiClient.ts apps/web/src/lib/apiClient.test.ts
git commit -m "feat(web): add authenticated API client with timeout and error mapping" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Shared types and the `useApi` hook

**Files:**
- Create: `apps/web/src/lib/types.ts`
- Create: `apps/web/src/lib/useApi.ts`
- Create: `apps/web/src/lib/useApiWarmup.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` from `./apiClient`.
- Produces:
  - `type Business = { id: string; ownerId: string; name: string; description?: string | null; email?: string | null; phone?: string | null; website?: string | null }`
  - `useApi<T>(path: string | null): { data: T | null; error: ApiError | null; loading: boolean; slow: boolean; refetch: () => void }`
  - `SLOW_RESPONSE_MS` (4000)
  - `useApiWarmup(): void` (fire-and-forget `GET /health`)

This task has no unit test: hooks need a DOM, which the Node-only Vitest setup lacks. Its behaviour (loading, slow notice, retry) is pinned by the Task 11 e2e tests.

- [ ] **Step 1: Create `types.ts`**

```ts
export type Business = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};
```

- [ ] **Step 2: Create `useApi.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "./apiClient";

/** After this long without a response, pages explain that the server may be waking up. */
export const SLOW_RESPONSE_MS = 4_000;

type ApiState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  slow: boolean;
};

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: path !== null,
    slow: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false, slow: false });
      return;
    }

    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: null, loading: true, slow: false }));

    const slowTimer = setTimeout(() => {
      setState((previous) => (previous.loading ? { ...previous, slow: true } : previous));
    }, SLOW_RESPONSE_MS);

    apiFetch<T>(path, { signal: controller.signal })
      .then((data) => {
        setState({ data, error: null, loading: false, slow: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState((previous) => ({
          ...previous,
          error:
            error instanceof ApiError
              ? error
              : new ApiError(0, "Something went wrong. Try again."),
          loading: false,
          slow: false,
        }));
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [path, attempt]);

  const refetch = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, refetch };
}
```

- [ ] **Step 3: Create `useApiWarmup.ts`**

```ts
"use client";

import { useEffect } from "react";
import { apiUrl } from "./api";

/**
 * Pings the API health endpoint so a sleeping free-tier server starts waking up
 * while the visitor reads the page. The result is intentionally ignored.
 */
export function useApiWarmup() {
  useEffect(() => {
    void fetch(apiUrl("/health")).catch(() => undefined);
  }, []);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: no errors from the new files. (If `.next/types` is missing, ignore only "file not found" include warnings; there must be no TypeScript errors.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/useApi.ts apps/web/src/lib/useApiWarmup.ts
git commit -m "feat(web): add useApi hook, shared types and API warm-up" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure helpers: navigation, formatting, preferences, menu keys, session mapping

**Files:**
- Create: `apps/web/src/lib/navigation.ts`, `apps/web/src/lib/navigation.test.ts`
- Create: `apps/web/src/lib/format.ts`, `apps/web/src/lib/format.test.ts`
- Create: `apps/web/src/lib/preferences.ts`, `apps/web/src/lib/preferences.test.ts`
- Create: `apps/web/src/lib/menuNav.ts`, `apps/web/src/lib/menuNav.test.ts`
- Create: `apps/web/src/lib/session.ts`, `apps/web/src/lib/session.test.ts`
- Create: `apps/web/src/lib/cn.ts`, `apps/web/src/lib/forms.ts`

**Interfaces (produced):**
- `BUSINESS_SECTIONS: readonly ["dashboard", "customers", "campaigns"]`
- `getBusinessIdFromPath(pathname: string): string | null`
- `pathForBusinessSwitch(pathname: string, nextBusinessId: string): string`
- `isNavActive(pathname: string, href: string, exact?: boolean): boolean`
- `monogramFor(name: string): string`
- `readPreference(key: string): string | null`, `writePreference(key: string, value: string): void`
- `type MenuKey = "ArrowDown" | "ArrowUp" | "Home" | "End"`, `nextMenuIndex(current: number, count: number, key: MenuKey): number`, `typeAheadIndex(labels: string[], query: string, current: number): number`
- `type SessionUser = { id: string; email: string | null; emailConfirmed: boolean }`, `toSessionUser(user): SessionUser`
- `cn(...parts: Array<string | false | null | undefined>): string`
- `focusFirstInvalid(form: HTMLFormElement | null): void`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  getBusinessIdFromPath,
  isNavActive,
  pathForBusinessSwitch,
} from "./navigation";

describe("getBusinessIdFromPath", () => {
  it("reads the business id from business routes", () => {
    expect(getBusinessIdFromPath("/businesses/b1/customers")).toBe("b1");
    expect(getBusinessIdFromPath("/businesses/b1")).toBe("b1");
    expect(getBusinessIdFromPath("/businesses/b1/campaigns/c9/logs")).toBe("b1");
  });

  it("returns null outside a business", () => {
    expect(getBusinessIdFromPath("/businesses")).toBeNull();
    expect(getBusinessIdFromPath("/businesses/")).toBeNull();
    expect(getBusinessIdFromPath("/login")).toBeNull();
    expect(getBusinessIdFromPath("/")).toBeNull();
  });
});

describe("pathForBusinessSwitch", () => {
  it("keeps the current section", () => {
    expect(pathForBusinessSwitch("/businesses/a/customers", "b")).toBe("/businesses/b/customers");
    expect(pathForBusinessSwitch("/businesses/a/dashboard", "b")).toBe("/businesses/b/dashboard");
  });

  it("goes to the campaign list from anywhere inside campaigns", () => {
    expect(pathForBusinessSwitch("/businesses/a/campaigns", "b")).toBe("/businesses/b/campaigns");
    expect(pathForBusinessSwitch("/businesses/a/campaigns/c1/analytics", "b")).toBe(
      "/businesses/b/campaigns",
    );
    expect(pathForBusinessSwitch("/businesses/a/campaigns/new", "b")).toBe(
      "/businesses/b/campaigns",
    );
  });

  it("opens the dashboard when not inside a business section", () => {
    expect(pathForBusinessSwitch("/businesses", "b")).toBe("/businesses/b/dashboard");
    expect(pathForBusinessSwitch("/businesses/a", "b")).toBe("/businesses/b/dashboard");
    expect(pathForBusinessSwitch("/account", "b")).toBe("/businesses/b/dashboard");
  });
});

describe("isNavActive", () => {
  it("matches the exact path and nested paths", () => {
    expect(isNavActive("/businesses/a/campaigns", "/businesses/a/campaigns")).toBe(true);
    expect(isNavActive("/businesses/a/campaigns/c1/logs", "/businesses/a/campaigns")).toBe(true);
  });

  it("does not match a sibling that shares a prefix", () => {
    expect(isNavActive("/businesses/a/customers", "/businesses/a/campaigns")).toBe(false);
    expect(isNavActive("/businesses/abc/dashboard", "/businesses/a")).toBe(false);
  });

  it("supports exact-only matching", () => {
    expect(isNavActive("/businesses", "/businesses", true)).toBe(true);
    expect(isNavActive("/businesses/a/dashboard", "/businesses", true)).toBe(false);
  });
});
```

`apps/web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { monogramFor } from "./format";

describe("monogramFor", () => {
  it("uses the first letter or digit, upper-cased", () => {
    expect(monogramFor("corner bakery")).toBe("C");
    expect(monogramFor("  fern florist")).toBe("F");
    expect(monogramFor("7th Street Cafe")).toBe("7");
  });

  it("skips symbols and emoji", () => {
    expect(monogramFor("😀 Night Market")).toBe("N");
    expect(monogramFor("—Étoile")).toBe("É");
  });

  it("falls back to a question mark", () => {
    expect(monogramFor("")).toBe("?");
    expect(monogramFor("   ")).toBe("?");
    expect(monogramFor("😀")).toBe("?");
  });
});
```

`apps/web/src/lib/preferences.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { readPreference, writePreference } from "./preferences";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preferences", () => {
  it("round-trips a value through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });

    writePreference("dc.sidebar", "collapsed");
    expect(readPreference("dc.sidebar")).toBe("collapsed");
    expect(readPreference("missing")).toBeNull();
  });

  it("returns null when storage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readPreference("dc.sidebar")).toBeNull();
    expect(() => writePreference("dc.sidebar", "collapsed")).not.toThrow();
  });

  it("swallows errors thrown by blocked storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(readPreference("dc.sidebar")).toBeNull();
    expect(() => writePreference("dc.sidebar", "collapsed")).not.toThrow();
  });
});
```

`apps/web/src/lib/menuNav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextMenuIndex, typeAheadIndex } from "./menuNav";

describe("nextMenuIndex", () => {
  it("moves down and wraps", () => {
    expect(nextMenuIndex(0, 3, "ArrowDown")).toBe(1);
    expect(nextMenuIndex(2, 3, "ArrowDown")).toBe(0);
    expect(nextMenuIndex(-1, 3, "ArrowDown")).toBe(0);
  });

  it("moves up and wraps", () => {
    expect(nextMenuIndex(1, 3, "ArrowUp")).toBe(0);
    expect(nextMenuIndex(0, 3, "ArrowUp")).toBe(2);
    expect(nextMenuIndex(-1, 3, "ArrowUp")).toBe(2);
  });

  it("jumps to the ends", () => {
    expect(nextMenuIndex(1, 4, "Home")).toBe(0);
    expect(nextMenuIndex(1, 4, "End")).toBe(3);
  });

  it("returns -1 for an empty menu", () => {
    expect(nextMenuIndex(0, 0, "ArrowDown")).toBe(-1);
  });
});

describe("typeAheadIndex", () => {
  const labels = ["Alpha Cafe", "Beta Shop", "Bakery Row", "Create business"];

  it("finds the next label starting with a single typed letter", () => {
    expect(typeAheadIndex(labels, "b", -1)).toBe(1);
    expect(typeAheadIndex(labels, "b", 1)).toBe(2);
    expect(typeAheadIndex(labels, "b", 2)).toBe(1);
  });

  it("refines with more letters from the current item", () => {
    expect(typeAheadIndex(labels, "ba", 1)).toBe(2);
  });

  it("ignores case and surrounding spaces", () => {
    expect(typeAheadIndex(labels, " CR ", 0)).toBe(3);
  });

  it("returns -1 when nothing matches or the query is empty", () => {
    expect(typeAheadIndex(labels, "z", 0)).toBe(-1);
    expect(typeAheadIndex(labels, "", 0)).toBe(-1);
  });
});
```

`apps/web/src/lib/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toSessionUser } from "./session";

describe("toSessionUser", () => {
  it("marks the email confirmed when email_confirmed_at is set", () => {
    expect(
      toSessionUser({
        id: "u1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        confirmed_at: undefined,
      }),
    ).toEqual({ id: "u1", email: "owner@example.com", emailConfirmed: true });
  });

  it("falls back to confirmed_at, matching the API check", () => {
    expect(
      toSessionUser({ id: "u1", email: "a@b.co", email_confirmed_at: undefined, confirmed_at: "x" })
        .emailConfirmed,
    ).toBe(true);
  });

  it("treats a missing confirmation and email as unconfirmed", () => {
    expect(
      toSessionUser({ id: "u1", email: undefined, email_confirmed_at: undefined, confirmed_at: undefined }),
    ).toEqual({ id: "u1", email: null, emailConfirmed: false });
  });
});
```

- [ ] **Step 2: Run and confirm they fail**

Run: `npx vitest run apps/web/src/lib/navigation.test.ts apps/web/src/lib/format.test.ts apps/web/src/lib/preferences.test.ts apps/web/src/lib/menuNav.test.ts apps/web/src/lib/session.test.ts`
Expected: FAIL (modules do not exist).

- [ ] **Step 3: Implement the helpers**

`apps/web/src/lib/navigation.ts`:

```ts
export const BUSINESS_SECTIONS = ["dashboard", "customers", "campaigns"] as const;

function segmentsOf(pathname: string): string[] {
  return pathname.split("?")[0].split("/").filter(Boolean);
}

/** `/businesses/<id>/...` gives `<id>`; anything else gives null. */
export function getBusinessIdFromPath(pathname: string): string | null {
  const [root, id] = segmentsOf(pathname);
  return root === "businesses" && id ? id : null;
}

/**
 * Where to go when the user picks another business: stay in the same section
 * (dashboard, customers, campaigns); anywhere else, open the new business's dashboard.
 * Campaign IDs belong to one business, so campaign sub-pages map to the campaign list.
 */
export function pathForBusinessSwitch(pathname: string, nextBusinessId: string): string {
  const [root, , section] = segmentsOf(pathname);
  if (root === "businesses" && (BUSINESS_SECTIONS as readonly string[]).includes(section ?? "")) {
    return `/businesses/${nextBusinessId}/${section}`;
  }
  return `/businesses/${nextBusinessId}/dashboard`;
}

export function isNavActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) {
    return true;
  }
  return !exact && pathname.startsWith(`${href}/`);
}
```

`apps/web/src/lib/format.ts`:

```ts
/** First letter or digit of a name, upper-cased, for the business tile. */
export function monogramFor(name: string): string {
  const match = name.match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "?";
}
```

`apps/web/src/lib/preferences.ts`:

```ts
/** localStorage can be missing or throw (private windows, blocked site data). */
export function readPreference(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Preferences are a convenience; losing one is fine.
  }
}
```

`apps/web/src/lib/menuNav.ts`:

```ts
export type MenuKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export function nextMenuIndex(current: number, count: number, key: MenuKey): number {
  if (count === 0) {
    return -1;
  }
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}

/**
 * Index of the next label that starts with what the user has typed.
 * One typed letter cycles forward from the current item; longer text refines in place.
 */
export function typeAheadIndex(labels: string[], query: string, current: number): number {
  const text = query.trim().toLowerCase();
  if (!text || labels.length === 0) {
    return -1;
  }
  const start = current < 0 ? 0 : current + (text.length === 1 ? 1 : 0);
  for (let offset = 0; offset < labels.length; offset += 1) {
    const index = (start + offset) % labels.length;
    if (labels[index].toLowerCase().startsWith(text)) {
      return index;
    }
  }
  return -1;
}
```

`apps/web/src/lib/session.ts`:

```ts
import type { User } from "@supabase/supabase-js";

export type SessionUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

/** Mirrors the API's `emailConfirmed` check so the UI can warn before the API refuses. */
export function toSessionUser(
  user: Pick<User, "id" | "email" | "email_confirmed_at" | "confirmed_at">,
): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
  };
}
```

`apps/web/src/lib/cn.ts`:

```ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
```

`apps/web/src/lib/forms.ts`:

```ts
/** Moves focus to the first field marked invalid, after React has rendered the errors. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
```

- [ ] **Step 4: Run and confirm they pass**

Run: `npx vitest run apps/web/src/lib`
Expected: PASS for all `apps/web/src/lib/*.test.ts` files (apiClient, navigation, format, preferences, menuNav, session).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): add navigation, formatting, preference, menu and session helpers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Core UI primitives (icons, button, spinner, skeleton, states, fields)

**Files (all new, under `apps/web/src/components/ui/`):**
- `icons.tsx`, `spinner.tsx`, `button.tsx`, `skeleton.tsx`, `state.tsx`, `field.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/cn`.
- Produces:
  - `IconName = "building" | "dashboard" | "users" | "send" | "user" | "logout" | "chevrons" | "check" | "plus" | "menu" | "x" | "panel" | "alert"`; `Icon({ name, className? })` (decorative, `aria-hidden`).
  - `Spinner({ className? })`
  - `Button({ variant?: "primary"|"secondary"|"ghost"|"danger"; size?: "sm"|"md"; loading?: boolean; ...ButtonHTMLAttributes })` (default `type="button"`, default variant `secondary`); `buttonClasses({ variant?, size?, className? }): string` for styling `<Link>`s.
  - `Skeleton({ className? })`, `PageSkeleton({ slow? })`
  - `SlowNotice()`, `EmptyState({ icon?: IconName; title; description?; action?: ReactNode })`, `ErrorState({ title?; message; onRetry? })`
  - `TextField({ label; hint?; error?; ...InputHTMLAttributes })`, `TextAreaField({ label; hint?; error?; ...TextareaHTMLAttributes })`; both link label, hint and error through `htmlFor`, `aria-describedby`, `aria-invalid`.

Verification for this task is type-check, lint, and the e2e tests in later tasks (the Node-only Vitest cannot render components).

- [ ] **Step 1: `icons.tsx`**

```tsx
import { cn } from "@/lib/cn";

const PATHS = {
  building:
    "M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 13h.01M15 13h.01",
  dashboard: "M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevrons: "M7 15l5 5 5-5M7 9l5-5 5 5",
  check: "M20 6 9 17l-5-5",
  plus: "M12 5v14M5 12h14",
  menu: "M3 6h18M3 12h18M3 18h18",
  x: "M18 6 6 18M6 6l12 12",
  panel: "M3 3h18v18H3zM9 3v18",
  alert: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
```

- [ ] **Step 2: `spinner.tsx`**

```tsx
import { cn } from "@/lib/cn";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-4 w-4 animate-spin", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 3: `button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink hover:bg-sunken",
  danger: "bg-danger text-canvas hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-3.5 text-sm lg:h-9",
  sm: "h-9 px-3 text-[13px] lg:h-8",
};

/** Use on a `<Link>` that should look like a button. */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
```

- [ ] **Step 4: `state.tsx`**

```tsx
import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon, type IconName } from "./icons";

export function SlowNotice() {
  return (
    <p className="text-sm text-muted">
      Waking up the server. The first load after a quiet period can take up to a minute.
    </p>
  );
}

export function EmptyState({
  icon = "building",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-container bg-accent-soft text-accent">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-container bg-danger-soft text-danger">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: `skeleton.tsx`**

```tsx
import { cn } from "@/lib/cn";
import { SlowNotice } from "./state";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-sunken", className)} />;
}

export function PageSkeleton({ slow = false }: { slow?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
      {slow ? <SlowNotice /> : null}
    </div>
  );
}
```

- [ ] **Step 6: `field.tsx`**

```tsx
import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldMeta = {
  label: string;
  hint?: string;
  error?: string | undefined;
};

const CONTROL =
  "block w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors duration-150";

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldMeta & { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-muted">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldMeta & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(CONTROL, "h-10 lg:h-9", error ? "border-danger" : "border-line-strong", className)}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(CONTROL, "min-h-24 resize-y py-2", error ? "border-danger" : "border-line-strong", className)}
        {...props}
      />
    </FieldFrame>
  );
}
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; lint shows no errors and no new warnings from `components/ui` (the 7 baseline warnings remain).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): add core UI primitives" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dialog and Toast

**Files:**
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/toast.tsx`
- Modify: `apps/web/src/app/globals.css` (append dialog animation)

**Interfaces:**
- Consumes: `Icon` (`x`), `cn`.
- Produces:
  - `Dialog({ open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; placement?: "center" | "left"; hideTitle?: boolean })`. Built on native `<dialog>.showModal()`; children mount only while open (so form state resets); Esc and backdrop click call `onClose`; body scroll locked while open; focus returns to the previously focused element on close. `onClose` is called only while `open` is true.
  - `ToastProvider({ children })`, `useToast(): { success(message: string): void; error(message: string): void }`. Success toasts live in a polite `role="status"` region and last 5s; errors in a `role="alert"` region and last 8s; at most 3 visible; each has a dismiss button.

- [ ] **Step 1: `dialog.tsx`**

```tsx
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  placement?: "center" | "left";
  /** Keep the title for screen readers but do not show a header. */
  hideTitle?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  placement = "center",
  hideTitle = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isDrawer = placement === "left";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Fires for Escape and for element.close(); only report user-initiated closes.
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className={cn(
        "bg-surface p-0 text-ink shadow-float backdrop:bg-black/50",
        isDrawer
          ? "drawer m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] overflow-visible border-r border-line"
          : "m-auto w-[calc(100%-2rem)] max-w-md rounded-container border border-line",
      )}
    >
      {open ? (
        <div className={cn(isDrawer ? "flex h-full flex-col" : "p-5")}>
          {hideTitle ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-mr-1.5 -mt-1.5 rounded-control p-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <Icon name="x" />
              </button>
            </div>
          )}
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
```

- [ ] **Step 2: Append the open animation to `globals.css`**

```bash
cat >> apps/web/src/app/globals.css <<'EOF'

/* Dialogs and drawers fade in when opened (a response to a user action). */
dialog[open] {
  animation: dialog-in 140ms ease-out;
}

dialog.drawer[open] {
  animation: drawer-in 160ms ease-out;
}

@keyframes dialog-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes drawer-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
EOF
```

- [ ] **Step 3: `toast.tsx`**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type Tone = "success" | "error";
type ToastItem = { id: number; tone: Tone; message: string };
type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const DURATION_MS: Record<Tone, number> = { success: 5_000, error: 8_000 };
const MAX_VISIBLE = 3;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current++;
      setItems((previous) => [...previous.slice(-(MAX_VISIBLE - 1)), { id, tone, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS[tone]),
      );
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", message),
    }),
    [push],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => clearTimeout(timer));
  }, []);

  function renderRegion(tone: Tone) {
    return items
      .filter((item) => item.tone === tone)
      .map((item) => (
        <div
          key={item.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-container border bg-surface p-3 text-sm shadow-float",
            tone === "error" ? "border-danger" : "border-line",
          )}
        >
          <span className={tone === "error" ? "text-danger" : "text-success"}>
            <Icon name={tone === "error" ? "alert" : "check"} className="mt-0.5" />
          </span>
          <p className="min-w-0 flex-1 text-ink">{item.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(item.id)}
            className="-m-1 rounded-control p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Icon name="x" />
          </button>
        </div>
      ));
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {renderRegion("success")}
        </div>
        <div role="alert" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {renderRegion("error")}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; no new lint warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/toast.tsx apps/web/src/app/globals.css
git commit -m "feat(web): add accessible dialog and toast primitives" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Menu primitive

**Files:**
- Create: `apps/web/src/components/ui/menu.tsx`

**Interfaces:**
- Consumes: `nextMenuIndex`, `typeAheadIndex`, `MenuKey` from `@/lib/menuNav`; `Icon`; `cn`.
- Produces:
  - `type MenuItem = { id: string; label: string; onSelect: () => void; selected?: boolean; icon?: ReactNode; separatorBefore?: boolean }`. Items with `selected` defined render as `role="menuitemradio"` with `aria-checked`; others as `role="menuitem"`.
  - `type MenuTriggerProps` (spread onto your own `<button>`): `{ ref; id; "aria-haspopup": "menu"; "aria-expanded": boolean; "aria-controls": string | undefined; onClick; onKeyDown }`.
  - `Menu({ items: MenuItem[]; trigger: (props: MenuTriggerProps) => ReactNode; align?: "start" | "end" })`.
  - Behaviour: click or ArrowDown opens focusing the selected (or first) item; ArrowUp opens on the last; arrows, Home, End move; type-ahead jumps; Escape closes and returns focus to the trigger; Tab closes and moves on naturally; outside pointer-down closes; selecting an item closes, returns focus to the trigger, then runs `onSelect`.

- [ ] **Step 1: `menu.tsx`**

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/cn";
import { nextMenuIndex, typeAheadIndex, type MenuKey } from "@/lib/menuNav";
import { Icon } from "./icons";

export type MenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
  selected?: boolean;
  icon?: ReactNode;
  separatorBefore?: boolean;
};

export type MenuTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>;
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

type MenuProps = {
  items: MenuItem[];
  trigger: (props: MenuTriggerProps) => ReactNode;
  align?: "start" | "end";
};

const TYPE_AHEAD_RESET_MS = 600;

export function Menu({ items, trigger, align = "start" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typed = useRef<{ text: string; timer: ReturnType<typeof setTimeout> | undefined }>({
    text: "",
    timer: undefined,
  });
  const triggerId = useId();
  const panelId = useId();
  const selectedIndex = items.findIndex((item) => item.selected);

  const openMenu = useCallback((index: number) => {
    setActiveIndex(index);
    setOpen(true);
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      itemRefs.current[activeIndex]?.focus();
    }
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        closeMenu(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    const buffer = typed.current;
    return () => clearTimeout(buffer.timer);
  }, []);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(items.length - 1);
    }
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event;

    if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      event.preventDefault();
      setActiveIndex(nextMenuIndex(activeIndex, items.length, key as MenuKey));
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (key === "Tab") {
      // Hand focus back first so the browser's Tab moves on from the trigger.
      triggerRef.current?.focus();
      closeMenu(false);
      return;
    }

    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      clearTimeout(typed.current.timer);
      typed.current.text += key;
      typed.current.timer = setTimeout(() => {
        typed.current.text = "";
      }, TYPE_AHEAD_RESET_MS);
      const index = typeAheadIndex(
        items.map((item) => item.label),
        typed.current.text,
        activeIndex,
      );
      if (index >= 0) {
        setActiveIndex(index);
      }
    }
  }

  function selectItem(item: MenuItem) {
    closeMenu(true);
    item.onSelect();
  }

  return (
    <div ref={wrapperRef} className="relative">
      {trigger({
        ref: triggerRef,
        id: triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? panelId : undefined,
        onClick: () => (open ? closeMenu(false) : openMenu(selectedIndex >= 0 ? selectedIndex : 0)),
        onKeyDown: handleTriggerKeyDown,
      })}

      {open ? (
        <div
          id={panelId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handlePanelKeyDown}
          className={cn(
            "absolute z-50 mt-1 max-h-80 min-w-64 overflow-auto rounded-container border border-line bg-surface p-1 shadow-float",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <div key={item.id}>
              {item.separatorBefore ? <div role="separator" className="my-1 h-px bg-line" /> : null}
              <button
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role={item.selected === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.selected === undefined ? undefined : item.selected}
                tabIndex={-1}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm text-ink transition-colors hover:bg-sunken focus:bg-sunken"
              >
                {item.icon}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.selected ? <Icon name="check" className="text-accent" /> : null}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; no new lint warnings.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/menu.tsx
git commit -m "feat(web): add keyboard-accessible menu primitive" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Session and businesses providers, business switcher, create-business dialog

**Files (all new, under `apps/web/src/components/shell/`):**
- `session-provider.tsx`, `businesses-provider.tsx`, `monogram.tsx`, `create-business-dialog.tsx`, `business-switcher.tsx`

**Interfaces:**
- Consumes: `supabase`; `toSessionUser`, `SessionUser`; `useApi`; `Business`; `apiFetch`, `ApiError`, `fieldErrorsFromApiError`; `Dialog`, `useToast`, `Menu`, `Icon`, `Button`, `TextField`, `TextAreaField`; `getBusinessIdFromPath`, `pathForBusinessSwitch`; `monogramFor`; `focusFirstInvalid`.
- Produces:
  - `SessionProvider({ children, fallback })` and `useSession(): SessionUser`. Renders `fallback` until a session is confirmed; redirects to `/login` when there is none, and on sign-out.
  - `BusinessesProvider({ children })` and `useBusinesses(): { businesses: Business[]; status: "loading" | "ready" | "error"; error: ApiError | null; slow: boolean; refetch: () => void; addBusiness: (business: Business) => void }`. `addBusiness` makes a just-created business available immediately (before the list refetch completes).
  - `Monogram({ name, size?: "sm" | "md" })`
  - `CreateBusinessDialog({ open, onClose })`: fields Business name (required), Description, Email, Phone, Website; shows "Enter a business name." if empty; maps API validation issues to fields; on success adds the business, shows toast "Business created", closes, and navigates to `/businesses/<id>/dashboard`.
  - `BusinessSwitcher({ collapsed, onNavigate? })`

- [ ] **Step 1: `session-provider.tsx`**

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toSessionUser, type SessionUser } from "@/lib/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUser(toSessionUser(data.session.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }
      if (!session) {
        setUser(null);
        router.replace("/login");
        return;
      }
      setUser(toSessionUser(session.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!user) {
    return <>{fallback}</>;
  }

  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return user;
}
```

- [ ] **Step 2: `businesses-provider.tsx`**

```tsx
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ApiError } from "@/lib/apiClient";
import type { Business } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type BusinessesContextValue = {
  businesses: Business[];
  status: "loading" | "ready" | "error";
  error: ApiError | null;
  slow: boolean;
  refetch: () => void;
  addBusiness: (business: Business) => void;
};

const BusinessesContext = createContext<BusinessesContextValue | null>(null);

export function BusinessesProvider({ children }: { children: ReactNode }) {
  const { data, error, slow, refetch } = useApi<Business[]>("/api/businesses");
  const [created, setCreated] = useState<Business[]>([]);

  const value = useMemo<BusinessesContextValue>(() => {
    const fetched = data ?? [];
    const justCreated = created.filter((candidate) => !fetched.some((business) => business.id === candidate.id));

    return {
      businesses: [...fetched, ...justCreated],
      status: data !== null ? "ready" : error ? "error" : "loading",
      error,
      slow,
      refetch,
      addBusiness: (business) => {
        setCreated((previous) => [...previous, business]);
        refetch();
      },
    };
  }, [data, error, slow, refetch, created]);

  return <BusinessesContext.Provider value={value}>{children}</BusinessesContext.Provider>;
}

export function useBusinesses(): BusinessesContextValue {
  const value = useContext(BusinessesContext);
  if (!value) {
    throw new Error("useBusinesses must be used inside BusinessesProvider");
  }
  return value;
}
```

- [ ] **Step 3: `monogram.tsx`**

```tsx
import { cn } from "@/lib/cn";
import { monogramFor } from "@/lib/format";

export function Monogram({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-control bg-accent-soft font-semibold text-accent",
        size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs",
      )}
    >
      {monogramFor(name)}
    </span>
  );
}
```

- [ ] **Step 4: `create-business-dialog.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import { focusFirstInvalid } from "@/lib/forms";
import type { Business } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useBusinesses } from "./businesses-provider";

type FormValues = {
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
};

const EMPTY: FormValues = { name: "", description: "", email: "", phone: "", website: "" };

export function CreateBusinessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a business"
      description="Each business has its own customers and campaigns."
    >
      <CreateBusinessForm onDone={onClose} />
    </Dialog>
  );
}

function CreateBusinessForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { addBusiness } = useBusinesses();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof FormValues) {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = values.name.trim();

    setFormError(null);
    if (!name) {
      setErrors({ name: "Enter a business name." });
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const business = await apiFetch<Business>("/api/businesses", {
        method: "POST",
        body: { ...values, name },
      });
      addBusiness(business);
      toast.success("Business created");
      onDone();
      router.push(`/businesses/${business.id}/dashboard`);
    } catch (error) {
      const fieldErrors = fieldErrorsFromApiError(error);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        focusFirstInvalid(form);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : "Could not create the business. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Business name"
        required
        autoFocus
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

      {formError ? (
        <p role="alert" className="rounded-control border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          Create business
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: `business-switcher.tsx`**

```tsx
"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBusinessIdFromPath, pathForBusinessSwitch } from "@/lib/navigation";
import { Icon } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useBusinesses } from "./businesses-provider";
import { CreateBusinessDialog } from "./create-business-dialog";
import { Monogram } from "./monogram";

export function BusinessSwitcher({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { businesses, status } = useBusinesses();
  const [creating, setCreating] = useState(false);

  const currentId = getBusinessIdFromPath(pathname);
  const current = businesses.find((business) => business.id === currentId) ?? null;

  const title =
    current?.name ??
    (status === "loading"
      ? "Loading businesses…"
      : status === "error"
        ? "Couldn’t load businesses"
        : businesses.length > 0
          ? "Choose a business"
          : "Create your first business");

  const items: MenuItem[] = [
    ...businesses.map((business) => ({
      id: business.id,
      label: business.name,
      selected: business.id === currentId,
      icon: <Monogram name={business.name} size="sm" />,
      onSelect: () => {
        if (business.id !== currentId) {
          router.push(pathForBusinessSwitch(pathname, business.id));
          onNavigate?.();
        }
      },
    })),
    {
      id: "create-business",
      label: "Create business",
      icon: <Icon name="plus" />,
      separatorBefore: businesses.length > 0,
      onSelect: () => setCreating(true),
    },
  ];

  return (
    <>
      <Menu
        items={items}
        trigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={collapsed ? (current ? `Managing ${current.name}` : title) : undefined}
            className={cn(
              "flex w-full items-center rounded-control border border-line bg-surface text-left transition-colors hover:bg-sunken",
              collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
            )}
          >
            <Monogram name={current?.name ?? "?"} />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{current ? "Managing" : "Business"}</span>
                  <span className="block truncate text-sm font-medium text-ink">{title}</span>
                </span>
                <Icon name="chevrons" className="text-muted" />
              </>
            )}
          </button>
        )}
      />
      <CreateBusinessDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json && npm run lint -w apps/web`
Expected: no TypeScript errors; no new lint warnings. (These components are not mounted yet; Task 9 wires them in and Task 11 tests them.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shell
git commit -m "feat(web): add session and businesses providers, business switcher and create dialog" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App shell, route group, business layout

**Files:**
- Move: `apps/web/src/app/businesses/` to `apps/web/src/app/(app)/businesses/` (unchanged except `<main>` becomes `<div>`)
- Create: `apps/web/src/components/shell/sidebar.tsx`, `app-shell.tsx`, `shell-skeleton.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`
- Create: `apps/web/src/app/(app)/businesses/[businessId]/layout.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4-8.
- Produces:
  - `Sidebar({ collapsed: boolean; onToggleCollapsed?: () => void; onNavigate?: () => void })`: a `<nav aria-label="Primary">` containing, top to bottom: wordmark (expanded only), `BusinessSwitcher`, group "Workspace" with link "Businesses" (active only on exactly `/businesses`), and, when inside a business, a group headed by the business name with links Dashboard, Customers, Campaigns (`aria-current="page"` on the active one); footer with the signed-in email, "Log out" button, and (when `onToggleCollapsed` is given) a collapse toggle with `aria-expanded`.
  - `AppShell({ children })`: desktop sticky sidebar (`w-64`, or `w-16` collapsed; preference key `dc.sidebar` with values `collapsed` / `expanded`), mobile top bar with "Open navigation" button opening the sidebar in a left `Dialog` titled "Navigation" (closes on route change), skip link "Skip to content" targeting `#main-content`, `<main id="main-content" tabIndex={-1}>`.
  - `ShellSkeleton()`.

- [ ] **Step 1: Move the authenticated pages into the route group**

```bash
mkdir -p "apps/web/src/app/(app)"
git mv apps/web/src/app/businesses "apps/web/src/app/(app)/businesses"
```

Expected: `git status` shows renames only.

- [ ] **Step 2: Replace `<main>` with `<div>` in the moved pages** (the shell provides the single `<main>` landmark)

```bash
find "apps/web/src/app/(app)/businesses" -name page.tsx -exec sed -i -e 's/<main\b/<div/' -e 's#</main>#</div>#' {} +
grep -rn "<main\|</main>" "apps/web/src/app/(app)" || echo "no main tags left"
```

Expected: `no main tags left`.

- [ ] **Step 3: `sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBusinessIdFromPath, isNavActive } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";
import { Icon, type IconName } from "@/components/ui/icons";
import { useBusinesses } from "./businesses-provider";
import { BusinessSwitcher } from "./business-switcher";
import { useSession } from "./session-provider";

type NavEntry = { href: string; label: string; icon: IconName; exact?: boolean };

function NavGroup({
  heading,
  entries,
  pathname,
  collapsed,
  onNavigate,
}: {
  heading: string;
  entries: NavEntry[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {collapsed ? (
        <div role="separator" className="mx-2 my-2 h-px bg-line" />
      ) : (
        <p className="truncate px-2.5 pb-1 pt-3 text-xs font-medium text-muted">{heading}</p>
      )}
      {entries.map((entry) => {
        const active = isNavActive(pathname, entry.href, entry.exact);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? entry.label : undefined}
            title={collapsed ? entry.label : undefined}
            className={cn(
              "flex items-center rounded-control text-sm font-medium transition-colors",
              "h-10 lg:h-9",
              collapsed ? "justify-center" : "gap-2.5 px-2.5",
              active ? "bg-accent-soft text-accent" : "text-ink hover:bg-sunken",
            )}
          >
            <Icon name={entry.icon} />
            {collapsed ? null : <span className="truncate">{entry.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSession();
  const { businesses } = useBusinesses();

  const businessId = getBusinessIdFromPath(pathname);
  const business = businesses.find((candidate) => candidate.id === businessId) ?? null;

  const businessEntries: NavEntry[] = business
    ? [
        { href: `/businesses/${business.id}/dashboard`, label: "Dashboard", icon: "dashboard" },
        { href: `/businesses/${business.id}/customers`, label: "Customers", icon: "users" },
        { href: `/businesses/${business.id}/campaigns`, label: "Campaigns", icon: "send" },
      ]
    : [];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("space-y-3 p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <p className="px-1 text-sm font-semibold tracking-tight text-ink">DireConnect</p>
        )}
        <BusinessSwitcher collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav aria-label="Primary" className={cn("min-h-0 flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        <NavGroup
          heading="Workspace"
          entries={[{ href: "/businesses", label: "Businesses", icon: "building", exact: true }]}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {business ? (
          <NavGroup
            heading={business.name}
            entries={businessEntries}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : null}
      </nav>

      <div className={cn("space-y-1 border-t border-line p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <p className="truncate px-2.5 pb-1 text-xs text-muted" title={user.email ?? undefined}>
            {user.email ?? "Signed in"}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex h-10 w-full items-center rounded-control text-sm font-medium text-ink transition-colors hover:bg-sunken lg:h-9",
            collapsed ? "justify-center" : "gap-2.5 px-2.5",
          )}
        >
          <Icon name="logout" />
          {collapsed ? null : "Log out"}
        </button>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-10 w-full items-center rounded-control text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink lg:h-9",
              collapsed ? "justify-center" : "gap-2.5 px-2.5",
            )}
          >
            <Icon name="panel" />
            {collapsed ? null : "Collapse"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `app-shell.tsx`**

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { readPreference, writePreference } from "@/lib/preferences";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import { Sidebar } from "./sidebar";

const SIDEBAR_KEY = "dc.sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readPreference(SIDEBAR_KEY) === "collapsed");
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writePreference(SIDEBAR_KEY, next ? "collapsed" : "expanded");
  }

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow-float"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-150 lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-control text-ink transition-colors hover:bg-sunken"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-tight">DireConnect</span>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Navigation"
        placement="left"
        hideTitle
      >
        <Sidebar collapsed={false} onNavigate={() => setDrawerOpen(false)} />
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: `shell-skeleton.tsx`**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the session is being confirmed, so the page does not flash. */
export function ShellSkeleton() {
  return (
    <div role="status" className="min-h-screen lg:flex">
      <span className="sr-only">Loading</span>
      <aside className="hidden h-screen w-64 shrink-0 space-y-3 border-r border-line bg-surface p-3 lg:block">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </aside>
      <div className="flex-1 space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full max-w-3xl" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: `(app)/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessesProvider } from "@/components/shell/businesses-provider";
import { SessionProvider } from "@/components/shell/session-provider";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider fallback={<ShellSkeleton />}>
        <BusinessesProvider>
          <AppShell>{children}</AppShell>
        </BusinessesProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
```

- [ ] **Step 7: `(app)/businesses/[businessId]/layout.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses, status, error, slow, refetch } = useBusinesses();

  if (status === "loading") {
    return <PageSkeleton slow={slow} />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Couldn’t load your businesses"
        message={error?.message ?? "Try again in a moment."}
        onRetry={refetch}
      />
    );
  }

  if (!businesses.some((business) => business.id === businessId)) {
    return (
      <EmptyState
        title="Business not found"
        description="This business doesn’t exist or isn’t part of your account."
        action={
          <Link href="/businesses" className={buttonClasses({ variant: "primary" })}>
            Back to businesses
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 8: Type-check, lint and build**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
```

Expected: no TypeScript errors; lint 0 errors (the 7 baseline warnings remain; none from new files); the build lists the same routes as the baseline (`/businesses`, `/businesses/[businessId]/...`) with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): add authenticated app shell with sidebar, drawer and business layout" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Auth pages and landing page

**Files:**
- Create: `apps/web/src/components/auth/auth-card.tsx`
- Move + rewrite: `apps/web/src/app/login/page.tsx` to `apps/web/src/app/(auth)/login/page.tsx`
- Move + rewrite: `apps/web/src/app/signup/page.tsx` to `apps/web/src/app/(auth)/signup/page.tsx`
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Rewrite: `apps/web/src/app/page.tsx`

**Interfaces:**
- Consumes: `TextField`, `Button`, `buttonClasses`, `supabase`, `focusFirstInvalid`, `useApiWarmup`.
- Produces: `AuthCard({ title; subtitle?; children; footer? })` with the page `<h1>`.
- Preserved e2e contract: login heading "Log in", placeholders `you@example.com` and `Your password`; landing page has exactly one link named "Log in" and one named "Sign up".

- [ ] **Step 1: Move the pages**

```bash
mkdir -p "apps/web/src/app/(auth)"
git mv apps/web/src/app/login "apps/web/src/app/(auth)/login"
git mv apps/web/src/app/signup "apps/web/src/app/(auth)/signup"
```

- [ ] **Step 2: `auth-card.tsx`**

```tsx
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <p className="mb-6 text-center text-sm font-semibold tracking-tight text-ink">DireConnect</p>
      <section className="rounded-container border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
      {footer ? <p className="mt-4 text-center text-sm text-muted">{footer}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: `(auth)/layout.tsx`**

```tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">{children}</main>
  );
}
```

- [ ] **Step 4: Rewrite `(auth)/login/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { focusFirstInvalid } from "@/lib/forms";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useApiWarmup();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(form);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    router.replace("/businesses");
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Access your DireConnect business dashboard."
      footer={
        <>
          Don’t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        {formError ? (
          <p role="alert" className="rounded-control border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 5: Rewrite `(auth)/signup/page.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { focusFirstInvalid } from "@/lib/forms";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkInbox, setCheckInbox] = useState(false);

  useApiWarmup();

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Choose a password.";
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(form);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // With email confirmation off, Supabase signs the user in straight away.
    if (data.session) {
      router.replace("/businesses");
      return;
    }

    setCheckInbox(true);
  }

  if (checkInbox) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${email.trim()}. Confirm your email before sending campaigns.`}
      >
        <Link href="/login" className={buttonClasses({ variant: "primary", className: "w-full" })}>
          Go to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Start managing your businesses and customer promotions."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        {formError ? (
          <p role="alert" className="rounded-control border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
```

- [ ] **Step 6: Rewrite `app/page.tsx` (landing)**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function Home() {
  const router = useRouter();

  useApiWarmup();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/businesses");
      }
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold tracking-tight">DireConnect</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Talk to your customers directly.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Keep your customer list in one place, send email campaigns to the people who asked to hear
          from you, and see what was delivered.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className={buttonClasses({ variant: "primary" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses({ variant: "secondary" })}>
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run the existing e2e tests, type-check and lint**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npm run lint -w apps/web
npx playwright test e2e/home.spec.ts
```

Expected: no TypeScript errors; lint 0 errors and the unused-`Image` warning in `app/page.tsx` is gone (6 baseline warnings remain); all 3 existing e2e tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): redesign auth pages and landing page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end tests, visual check and final verification

**Files:**
- Create: `e2e/helpers/app.ts`
- Create: `e2e/shell.spec.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-08-ui-redesign-design.md` (phase 1 wording)

**Interfaces:**
- Produces: `signIn(page)` (seeds a far-future Supabase session in `localStorage` under the key `sb-example-auth-token`, which `@supabase/supabase-js` derives from the fake URL `https://example.supabase.co`), `mockApi(page, options)` (intercepts `http://localhost:4000/**` and `https://example.supabase.co/**`, answers CORS preflights), `business(id, name)`.

- [ ] **Step 1: `e2e/helpers/app.ts`**

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

type ApiMockOptions = {
  businesses: MockBusiness[];
  /** Delays every non-preflight API response, to simulate a sleeping server. */
  delayMs?: number;
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

export async function mockApi(page: Page, options: ApiMockOptions) {
  const state = { businesses: [...options.businesses], created: [] as Array<Record<string, unknown>> };

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

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }

    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    if (url.pathname === "/health") {
      return json(200, { status: "ok" });
    }

    if (url.pathname === "/api/businesses" && request.method() === "GET") {
      return json(200, state.businesses);
    }

    if (url.pathname === "/api/businesses" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      if (body.email === "bad") {
        return json(400, {
          error: "Invalid request body",
          details: [{ path: ["email"], message: "Invalid email" }],
        });
      }
      state.created.push(body);
      const created = business(`new-${state.created.length}`, String(body.name));
      state.businesses.push(created);
      return json(201, created);
    }

    const dashboard = url.pathname.match(/^\/api\/businesses\/([^/]+)\/dashboard$/);
    if (dashboard) {
      const match = state.businesses.find((candidate) => candidate.id === dashboard[1]);
      return match ? json(200, emptyDashboard(match)) : json(404, { error: "Business not found" });
    }

    if (/^\/api\/businesses\/[^/]+\/(customers|campaigns)$/.test(url.pathname)) {
      return json(200, []);
    }

    return json(404, { error: "Not mocked" });
  });

  return state;
}
```

- [ ] **Step 2: `e2e/shell.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { business, mockApi, signIn } from "./helpers/app";

const bakery = business("b1", "Corner Bakery");
const florist = business("b2", "Fern Florist");

test("signed-out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/businesses");
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("the sidebar shows the workspace and the selected business", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/customers");

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Businesses", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Customers", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(nav.getByRole("link", { name: "Dashboard", exact: true })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("button", { name: /Managing Corner Bakery/ })).toBeVisible();
    await expect(page.getByText("owner@example.com")).toBeVisible();
  });

  test("switching business with the keyboard keeps the current section", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/customers");

    await page.getByRole("button", { name: /Managing Corner Bakery/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitemradio", { name: "Corner Bakery" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitemradio", { name: "Fern Florist" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/businesses\/b2\/customers$/);
    await expect(page.getByRole("button", { name: /Managing Fern Florist/ })).toBeVisible();
  });

  test("Escape closes the business menu and returns focus to its button", async ({ page }) => {
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/dashboard");

    const trigger = page.getByRole("button", { name: /Managing Corner Bakery/ });
    await trigger.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("an unknown business shows a not-found message", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/nope/dashboard");

    await expect(page.getByRole("heading", { name: "Business not found" })).toBeVisible();
    await page.getByRole("link", { name: "Back to businesses" }).click();
    await expect(page).toHaveURL(/\/businesses$/);
  });

  test("a new account is invited to create its first business", async ({ page }) => {
    await mockApi(page, { businesses: [] });
    await page.goto("/businesses");

    await expect(page.getByRole("button", { name: /Create your first business/ })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Businesses", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("creating a business validates, saves and opens its dashboard", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("button", { name: /Managing Corner Bakery/ }).click();
    await page.getByRole("menuitem", { name: "Create business" }).click();

    const dialog = page.getByRole("dialog", { name: "Create a business" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create business" }).click();
    await expect(dialog.getByText("Enter a business name.")).toBeVisible();
    await expect(dialog.getByLabel("Business name")).toBeFocused();

    await dialog.getByLabel("Business name").fill("Night Market");
    await dialog.getByLabel("Email").fill("bad");
    await dialog.getByRole("button", { name: "Create business" }).click();
    await expect(dialog.getByText("Invalid email")).toBeVisible();

    await dialog.getByLabel("Email").fill("");
    await dialog.getByRole("button", { name: "Create business" }).click();

    await expect(page).toHaveURL(/\/businesses\/new-1\/dashboard$/);
    await expect(page.getByText("Business created")).toBeVisible();
    await expect(page.getByRole("button", { name: /Managing Night Market/ })).toBeVisible();
  });

  test("a slow API shows the waking-up notice instead of an error", async ({ page }) => {
    // The notice appears after 4s and the response arrives at 6s, leaving a 2s window.
    await mockApi(page, { businesses: [bakery], delayMs: 6_000 });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByText(/Waking up the server/)).toBeVisible();
    await expect(page.getByText(/Couldn.t load your businesses/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Managing Corner Bakery/ })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("the sidebar can be collapsed and remembers the choice", async ({ page }) => {
    await mockApi(page, { businesses: [bakery] });
    await page.goto("/businesses/b1/dashboard");

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await page.reload();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("navigation opens in a drawer that closes with Escape", async ({ page }) => {
    await signIn(page);
    await mockApi(page, { businesses: [bakery, florist] });
    await page.goto("/businesses/b1/dashboard");

    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

    const opener = page.getByRole("button", { name: "Open navigation" });
    await opener.click();

    const drawer = page.getByRole("dialog", { name: "Navigation" });
    await expect(drawer.getByRole("link", { name: "Customers", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
```

- [ ] **Step 3: `e2e/auth.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("login explains missing fields inline and focuses the first one", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Enter your password.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeFocused();
});

test("login and signup link to each other", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("signup explains missing fields inline", async ({ page }) => {
  await page.goto("/signup");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Enter your email address.")).toBeVisible();
  await expect(page.getByText("Choose a password.")).toBeVisible();
});
```

- [ ] **Step 4: Run the e2e suite**

Run: `npx playwright test`
Expected: all tests pass (3 existing in `home.spec.ts`, 3 in `auth.spec.ts`, 10 in `shell.spec.ts`).

If a test fails, diagnose rather than loosening it. Two likely, legitimate adjustments:
- If the session seeding is not picked up (redirected to `/login`), print `Object.keys(localStorage)` after `page.goto` in a throwaway test and correct the key in `signIn`.
- If requests to `example.supabase.co` appear in the Playwright trace and cause noise, they are already stubbed in `mockApi`; confirm `mockApi` runs before `page.goto`.

- [ ] **Step 5: Run the full unit suite, lint and production build**

```bash
npx vitest run
npm run lint -w apps/web
NEXT_PUBLIC_API_URL=http://localhost:4000 NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fake npm run build -w apps/web
```

Expected:
- Vitest: only the known baseline failure (`apps/api/src/routes/campaign.test.ts`, `SUPABASE_JWT_SECRET`); every other file passes, including the new `tokens`, `apiClient`, `navigation`, `format`, `preferences`, `menuNav`, `session` tests.
- Lint: 0 errors; at most 6 warnings (the baseline minus the removed `Image` warning), none in new files.
- Build: succeeds.

- [ ] **Step 6: Visual and keyboard check in a browser**

With the mocked API unavailable outside Playwright, use Playwright's headed mode on the shell spec to look at the result:

```bash
npx playwright test e2e/shell.spec.ts --headed --project=chromium -g "sidebar shows"
```

Then, in a browser against `npm run dev:web`, check the unauthenticated pages (`/`, `/login`, `/signup`) at widths 375, 768 and 1280, in light and dark (emulate with DevTools "Rendering" or the browser's colour-scheme setting). Check by eye and record what you saw:
- text is legible and nothing overflows horizontally at 375px;
- the focus ring is visible on every control when tabbing through `/login`;
- with "reduce motion" enabled, nothing animates.

Authenticated pages need a real Supabase and API (or the e2e mocks); note in the report whether they were checked with real data or only with mocks. The legacy pages (businesses, customers, campaigns, dashboard) intentionally still look dark inside the new shell until phases 2-5.

- [ ] **Step 7: Update the spec's phase wording and commit**

In `docs/superpowers/specs/2026-10-08-ui-redesign-design.md`, replace the line

`1. Tokens, primitives, data layer, shell, business switcher, auth layouts, landing fix.`

with

`1. Tokens, data layer, the primitives the shell needs (Button, Field, Dialog, Menu, Toast, Skeleton, EmptyState/ErrorState, Icon), app shell, business switcher, auth pages, landing fix. Remaining primitives (Select, Checkbox, ConfirmDialog, Table, Tabs, Badge/StatusBadge, PageHeader, Breadcrumbs) are added in the phase that first uses them.`

Then:

```bash
git add e2e docs/superpowers/specs/2026-10-08-ui-redesign-design.md
git commit -m "test(web): add shell and auth e2e tests; clarify phase 1 scope in spec" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Report**

Summarise for the user: what shipped, the verification commands run and their actual output, the known baseline failure, which checks used mocks versus real data, and that legacy pages are visually transitional (dark pages inside the new shell) until phases 2-5. Recommend not deploying `ui-redesign` to production Vercel until at least phase 3.
