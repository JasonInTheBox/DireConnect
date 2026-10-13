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
  /** Makes the first DELETE request (business or customer) fail with a 500. */
  failFirstDelete?: boolean;
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
    deleteFailed: false,
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

    if (request.method() === "DELETE" && options.failFirstDelete && !state.deleteFailed) {
      state.deleteFailed = true;
      return json(500, { error: "Could not delete right now" });
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
