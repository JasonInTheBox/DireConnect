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

export type MockCampaign = {
  id: string;
  ownerId: string;
  businessId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS";
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  sendAt: string | null;
  targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
  createdAt: string;
  updatedAt: string;
};

export function campaign(
  id: string,
  title: string,
  overrides: Partial<MockCampaign> = {},
  businessId = "b1",
): MockCampaign {
  return {
    id,
    ownerId: "user-1",
    businessId,
    title,
    message: `Message for ${title}`,
    channel: "EMAIL",
    status: "DRAFT",
    sendAt: null,
    targetAudience: "ALL",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

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

/** Seeds a signed-in Supabase session; the client reads it locally and does not verify it. */
export async function signIn(page: Page, options: { emailConfirmed?: boolean } = {}) {
  const emailConfirmed = options.emailConfirmed ?? true;
  await page.addInitScript((confirmed: boolean) => {
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
          ...(confirmed ? { email_confirmed_at: "2026-01-01T00:00:00Z" } : {}),
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    );
  }, emailConfirmed);
}

export type RecordedRequest = { method: string; path: string; body: unknown };

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
  /** Dashboard extras per business id (campaign counts, message counts, recent campaigns). */
  dashboards?: Record<string, MockDashboardData>;
  /** Makes the first dashboard request fail with a 500. */
  failFirstDashboardGet?: boolean;
  /** Campaigns per business id. */
  campaigns?: Record<string, MockCampaign[]>;
  /** Delivery numbers per campaign id (missing fields are zero). */
  analytics?: Record<string, MockAnalytics>;
  /** Message logs per campaign id. */
  logs?: Record<string, MockLog[]>;
  /** Campaign ids whose analytics request fails with a 500. */
  failAnalyticsFor?: string[];
  /** Makes every queue request fail with this status and message. */
  queueError?: { status: number; error: string };
  /** Makes Supabase auth calls fail: `updateUser` answers 422 with this message. */
  authErrors?: { updateUser?: string };
  /** When true, a refreshed session reports the email as confirmed. */
  confirmedAfterRefresh?: boolean;
};

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

/** Mirrors the API's live eligibility for a draft (no snapshot yet). */
function previewFor(target: MockCampaign, customers: MockCustomer[]) {
  const results = customers.map((item) => {
    if (!item.emailOptIn || item.unsubscribedAt) {
      return {
        customerId: item.id,
        recipient: item.email,
        eligible: false,
        reason: item.unsubscribedAt ? "Customer has unsubscribed" : "Customer has not opted in to EMAIL",
      };
    }
    if (!item.email) {
      return {
        customerId: item.id,
        recipient: null,
        eligible: false,
        reason: "Customer has no EMAIL recipient",
      };
    }
    return { customerId: item.id, recipient: item.email, eligible: true, reason: null };
  });

  const eligible = results.filter((result) => result.eligible);
  const skipped = results.filter((result) => !result.eligible);
  const skippedByReason: Record<string, number> = {};
  for (const result of skipped) {
    const reason = result.reason ?? "Unknown reason";
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
  }

  return {
    campaign: {
      id: target.id,
      title: target.title,
      channel: target.channel,
      targetAudience: target.targetAudience,
      status: target.status,
    },
    summary: {
      totalCustomers: results.length,
      eligibleCount: eligible.length,
      skippedCount: skipped.length,
      skippedByReason,
      isSnapshot: target.status !== "DRAFT",
    },
    eligible,
    skipped,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mirrors the API schema: a campaign needs a non-blank title and message. */
function campaignBodyErrors(body: Record<string, unknown> | undefined) {
  const details: Array<{ path: string[]; message: string }> = [];
  if (!String(body?.title ?? "").trim()) {
    details.push({ path: ["title"], message: "Campaign title is required" });
  }
  if (!String(body?.message ?? "").trim()) {
    details.push({ path: ["message"], message: "Message is required" });
  }
  return details;
}

export async function mockApi(page: Page, options: ApiMockOptions) {
  const state = {
    businesses: [...options.businesses],
    customers: Object.fromEntries(
      Object.entries(options.customers ?? {}).map(([id, list]) => [id, [...list]]),
    ) as Record<string, MockCustomer[]>,
    created: [] as Array<Record<string, unknown>>,
    requests: [] as RecordedRequest[],
    campaigns: Object.fromEntries(
      Object.entries(options.campaigns ?? {}).map(([id, list]) => [id, list.map((item) => ({ ...item }))]),
    ) as Record<string, MockCampaign[]>,
    nextCampaignId: 2000,
    nextCustomerId: 1000,
    customersGetFailed: false,
    deleteFailed: false,
    dashboardGetFailed: false,
    authRequests: [] as RecordedRequest[],
  };

  // The Supabase client may try to reach its (fake) host; keep it quiet and offline.
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
      if (options.failFirstDashboardGet && !state.dashboardGetFailed) {
        state.dashboardGetFailed = true;
        return json(500, { error: "Dashboard unavailable" });
      }
      const match = state.businesses.find((candidate) => candidate.id === dashboard[1]);
      return match
        ? json(200, dashboardFor(match, state.customers[match.id] ?? [], options.dashboards?.[match.id]))
        : json(404, { error: "Business not found" });
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

    const campaignRoute = url.pathname.match(
      /^\/api\/businesses\/([^/]+)\/campaigns(?:\/([^/]+))?(?:\/(analytics|preview|queue|logs))?$/,
    );
    if (campaignRoute) {
      const [, businessId, campaignId, action] = campaignRoute;
      const list = (state.campaigns[businessId] ??= []);
      const target = campaignId ? list.find((item) => item.id === campaignId) : undefined;
      const now = new Date().toISOString();

      if (!campaignId && request.method() === "GET") {
        return json(200, [...list]);
      }

      if (!campaignId && request.method() === "POST") {
        if (body?.channel === "SMS") {
          return json(422, {
            error: "SMS campaigns are temporarily disabled. Create an email campaign instead.",
          });
        }
        const invalid = campaignBodyErrors(body);
        if (invalid.length > 0) {
          return json(400, { error: "Invalid request body", details: invalid });
        }
        const created = campaign(
          `n-${state.nextCampaignId++}`,
          String(body?.title),
          {
            message: String(body?.message ?? ""),
            targetAudience: (body?.targetAudience as MockCampaign["targetAudience"]) ?? "ALL",
            sendAt: body?.sendAt ? String(body.sendAt) : null,
            createdAt: now,
            updatedAt: now,
          },
          businessId,
        );
        list.unshift(created);
        return json(201, created);
      }

      if (campaignId && !action && request.method() === "PUT") {
        if (!target || target.status !== "DRAFT" || target.channel !== "EMAIL") {
          return json(404, {
            error: "Campaign not found. Queued or sent campaigns cannot be edited.",
          });
        }
        const invalid = campaignBodyErrors(body);
        if (invalid.length > 0) {
          return json(400, { error: "Invalid request body", details: invalid });
        }
        target.title = String(body?.title);
        target.message = String(body?.message ?? "");
        target.targetAudience = (body?.targetAudience as MockCampaign["targetAudience"]) ?? "ALL";
        target.sendAt = body?.sendAt ? String(body.sendAt) : null;
        target.updatedAt = now;
        return json(200, target);
      }

      if (campaignId && !action && request.method() === "DELETE") {
        if (!target || target.status !== "DRAFT") {
          return json(404, {
            error: "Campaign not found. Queued or sent campaigns cannot be deleted.",
          });
        }
        state.campaigns[businessId] = list.filter((item) => item.id !== campaignId);
        return noContent();
      }

      if (campaignId && action === "analytics" && request.method() === "GET") {
        if (!target) {
          return json(404, { error: "Campaign not found" });
        }
        if (options.failAnalyticsFor?.includes(campaignId)) {
          return json(500, { error: "Analytics unavailable" });
        }
        const {
          skippedByReason = {},
          failedByReason = {},
          analyticsSource = "SNAPSHOT",
          ...counts
        } = options.analytics?.[campaignId] ?? {};
        const numbers = {
          eligibleCount: 0,
          sentCount: 0,
          failedDeliveryCount: 0,
          pendingCount: 0,
          skippedBeforeSendCount: 0,
          ...counts,
        };
        const attempted = numbers.sentCount + numbers.failedDeliveryCount + numbers.pendingCount;
        return json(200, {
          campaign: {
            id: target.id,
            title: target.title,
            channel: target.channel,
            targetAudience: target.targetAudience,
            status: target.status,
          },
          summary: {
            analyticsSource,
            hasSnapshot: analyticsSource === "SNAPSHOT",
            totalSnapshotCount: numbers.eligibleCount + numbers.skippedBeforeSendCount,
            totalRecipientCount: numbers.eligibleCount + numbers.skippedBeforeSendCount,
            attemptedSendCount: attempted,
            totalLogCount: attempted,
            sentRate: attempted > 0 ? Math.round((numbers.sentCount / attempted) * 100) : null,
            skippedByReason,
            failedByReason,
            ...numbers,
          },
        });
      }

      if (campaignId && action === "logs" && request.method() === "GET") {
        return target
          ? json(200, options.logs?.[campaignId] ?? [])
          : json(404, { error: "Campaign not found" });
      }

      if (campaignId && action === "preview" && request.method() === "GET") {
        return target
          ? json(200, previewFor(target, state.customers[businessId] ?? []))
          : json(404, { error: "Campaign not found" });
      }

      if (campaignId && action === "queue" && request.method() === "POST") {
        if (options.queueError) {
          return json(options.queueError.status, { error: options.queueError.error });
        }
        if (!target || target.status !== "DRAFT") {
          return json(404, { error: "Draft campaign not found or campaign is already queued/sent" });
        }
        const eligibleCount = previewFor(target, state.customers[businessId] ?? []).summary
          .eligibleCount;
        if (eligibleCount === 0) {
          return json(409, { error: "This campaign has no eligible, opted-in email recipients." });
        }
        if (eligibleCount > 10) {
          return json(409, {
            error: "Campaigns are limited to 10 recipients. Narrow the audience before sending.",
            eligibleCount,
            maxRecipients: 10,
          });
        }
        target.status = "QUEUED";
        target.updatedAt = now;
        return json(200, {
          message: target.sendAt ? "Campaign scheduled successfully" : "Campaign queued successfully",
          campaignId,
          delay: 0,
          scheduledFor: target.sendAt,
        });
      }
    }

    return json(404, { error: "Not mocked" });
  });

  return state;
}
