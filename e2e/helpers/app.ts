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
