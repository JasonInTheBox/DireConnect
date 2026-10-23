import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createKeepaliveRouter } from "./keepalive.ts";

const TOKEN = "correct-horse-battery-staple-token";
const SUPABASE_URL = "https://abcdefgh.supabase.co";
const SUPABASE_KEY = "sb_publishable_test_key";
const FIXED_NOW = new Date("2026-10-23T05:17:00.000Z");

const mocks = {
  queryRaw: vi.fn(),
  ping: vi.fn(),
  set: vi.fn(),
  getRedis: vi.fn(),
  fetchImpl: vi.fn(),
};

function createTestApp(overrides: Record<string, unknown> = {}) {
  const router = createKeepaliveRouter({
    db: { $queryRaw: mocks.queryRaw } as any,
    getRedis: mocks.getRedis as any,
    fetchImpl: mocks.fetchImpl as any,
    token: TOKEN,
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_KEY,
    timeoutMs: 1000,
    now: () => FIXED_NOW,
    ...overrides,
  });

  const app = express();
  app.use("/api/keepalive", router);

  return app;
}

function expectNoDependencyCalled() {
  expect(mocks.queryRaw).not.toHaveBeenCalled();
  expect(mocks.getRedis).not.toHaveBeenCalled();
  expect(mocks.ping).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.fetchImpl).not.toHaveBeenCalled();
}

function authed(app: express.Express) {
  return request(app)
    .get("/api/keepalive")
    .set("Authorization", `Bearer ${TOKEN}`);
}

describe("GET /api/keepalive", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mocks.ping.mockResolvedValue("PONG");
    mocks.set.mockResolvedValue("OK");
    mocks.getRedis.mockResolvedValue({ ping: mocks.ping, set: mocks.set });
    mocks.fetchImpl.mockResolvedValue({ ok: true, status: 200 });
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe("authentication", () => {
    it("is disabled (404) and calls no dependency when no token is configured", async () => {
      const response = await request(createTestApp({ token: "" }))
        .get("/api/keepalive")
        .set("Authorization", `Bearer ${TOKEN}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "Not found" });
      expectNoDependencyCalled();
    });

    it("falls back to KEEPALIVE_TOKEN from the environment and stays disabled when it is unset", async () => {
      vi.stubEnv("KEEPALIVE_TOKEN", "");
      const disabled = await request(createTestApp({ token: undefined }))
        .get("/api/keepalive")
        .set("Authorization", `Bearer ${TOKEN}`);

      expect(disabled.status).toBe(404);
      expectNoDependencyCalled();

      vi.stubEnv("KEEPALIVE_TOKEN", "env-token-value");
      const enabled = await request(createTestApp({ token: undefined }))
        .get("/api/keepalive")
        .set("Authorization", "Bearer env-token-value");

      expect(enabled.status).toBe(200);
    });

    it("rejects a missing Authorization header with 401 and calls no dependency", async () => {
      const response = await request(createTestApp()).get("/api/keepalive");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expectNoDependencyCalled();
    });

    it("rejects a wrong token of the same length with 401", async () => {
      const wrong = "x".repeat(TOKEN.length);
      const response = await request(createTestApp())
        .get("/api/keepalive")
        .set("Authorization", `Bearer ${wrong}`);

      expect(response.status).toBe(401);
      expectNoDependencyCalled();
    });

    it("rejects wrong tokens of any length (shorter, longer, empty) without throwing", async () => {
      for (const wrong of ["short", `${TOKEN}-and-more`, ""]) {
        const response = await request(createTestApp())
          .get("/api/keepalive")
          .set("Authorization", `Bearer ${wrong}`);

        expect(response.status).toBe(401);
      }

      expectNoDependencyCalled();
    });

    it("rejects a non-bearer scheme and a bare token with 401", async () => {
      for (const header of [`Basic ${TOKEN}`, TOKEN, `Bearer`]) {
        const response = await request(createTestApp())
          .get("/api/keepalive")
          .set("Authorization", header);

        expect(response.status).toBe(401);
      }

      expectNoDependencyCalled();
    });

    it("never echoes the submitted or configured token in a rejection", async () => {
      const response = await request(createTestApp())
        .get("/api/keepalive")
        .set("Authorization", "Bearer submitted-secret-value");

      expect(JSON.stringify(response.body)).not.toContain("submitted-secret-value");
      expect(JSON.stringify(response.body)).not.toContain(TOKEN);
      expect(JSON.stringify(response.headers)).not.toContain(TOKEN);
    });

    it("accepts the correct bearer token", async () => {
      const response = await authed(createTestApp());

      expect(response.status).toBe(200);
    });
  });

  describe("when every check succeeds", () => {
    it("returns 200 with all checks ok and a timestamp", async () => {
      const response = await authed(createTestApp());

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toEqual({
        status: "ok",
        checks: { database: "ok", redis: "ok", supabase: "ok" },
        timestamp: FIXED_NOW.toISOString(),
      });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("runs a real raw query against the database", async () => {
      await authed(createTestApp());

      expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
      const [strings] = mocks.queryRaw.mock.calls[0];
      expect(Array.from(strings).join("")).toBe("SELECT 1");
    });

    it("pings Redis and writes a key with an expiry", async () => {
      await authed(createTestApp());

      expect(mocks.ping).toHaveBeenCalledTimes(1);
      expect(mocks.set).toHaveBeenCalledTimes(1);
      expect(mocks.set).toHaveBeenCalledWith(
        "keepalive:last",
        FIXED_NOW.toISOString(),
        "EX",
        60 * 60 * 24 * 14,
      );
    });

    it("requests Supabase Auth settings with the apikey header", async () => {
      await authed(createTestApp());

      expect(mocks.fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = mocks.fetchImpl.mock.calls[0];
      expect(url).toBe(`${SUPABASE_URL}/auth/v1/settings`);
      expect(init.headers).toEqual({ apikey: SUPABASE_KEY });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("does not double the slash when the Supabase URL has a trailing slash", async () => {
      await authed(createTestApp({ supabaseUrl: `${SUPABASE_URL}/` }));

      expect(mocks.fetchImpl.mock.calls[0][0]).toBe(
        `${SUPABASE_URL}/auth/v1/settings`,
      );
    });
  });

  describe("when a dependency fails", () => {
    const secretNoise =
      "postgresql://postgres:hunter2@db.internal.example:5432/postgres";

    function expectCleanBody(body: unknown) {
      const text = JSON.stringify(body);
      expect(text).not.toContain("hunter2");
      expect(text).not.toContain("postgresql://");
      expect(text).not.toContain("internal.example");
      expect(text).not.toContain("stack");
      expect(text).not.toContain(" at ");
      expect(text).not.toContain("http");
      expect(text).not.toContain(TOKEN);
      expect(text).not.toContain(SUPABASE_KEY);
    }

    it("reports only the database as failed when it rejects", async () => {
      mocks.queryRaw.mockRejectedValue(new Error(`connect failed ${secretNoise}`));

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("degraded");
      expect(response.body.checks).toEqual({
        database: "failed",
        redis: "ok",
        supabase: "ok",
      });
      expect(response.body.timestamp).toBe(FIXED_NOW.toISOString());
      expect(mocks.ping).toHaveBeenCalled();
      expect(mocks.fetchImpl).toHaveBeenCalled();
      expectCleanBody(response.body);
      expect(errorSpy).toHaveBeenCalledWith(
        "keepalive check failed",
        "database",
        expect.anything(),
      );
    });

    it("reports only Redis as failed when it rejects", async () => {
      mocks.ping.mockRejectedValue(new Error(`ECONNREFUSED ${secretNoise}`));

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("degraded");
      expect(response.body.checks).toEqual({
        database: "ok",
        redis: "failed",
        supabase: "ok",
      });
      expectCleanBody(response.body);
      expect(errorSpy).toHaveBeenCalledWith(
        "keepalive check failed",
        "redis",
        expect.anything(),
      );
    });

    it("reports Redis as failed when the set command rejects", async () => {
      mocks.set.mockRejectedValue(new Error("READONLY You can't write"));

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.checks.redis).toBe("failed");
      expect(response.body.checks.database).toBe("ok");
    });

    it("reports Redis as failed when the client cannot be obtained", async () => {
      mocks.getRedis.mockRejectedValue(new Error(secretNoise));

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.checks.redis).toBe("failed");
      expectCleanBody(response.body);
    });

    it("reports only Supabase as failed when fetch rejects", async () => {
      mocks.fetchImpl.mockRejectedValue(
        new TypeError(`fetch failed ${SUPABASE_URL}/auth/v1/settings`),
      );

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("degraded");
      expect(response.body.checks).toEqual({
        database: "ok",
        redis: "ok",
        supabase: "failed",
      });
      expectCleanBody(response.body);
      expect(errorSpy).toHaveBeenCalledWith(
        "keepalive check failed",
        "supabase",
        expect.anything(),
      );
    });

    it("reports Supabase as failed when it answers with a non-2xx status", async () => {
      mocks.fetchImpl.mockResolvedValue({ ok: false, status: 503 });

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.checks).toEqual({
        database: "ok",
        redis: "ok",
        supabase: "failed",
      });
      expectCleanBody(response.body);
    });

    it("reports Supabase as failed when the project URL or key is not configured", async () => {
      const response = await authed(
        createTestApp({ supabaseUrl: "", supabaseKey: "" }),
      );

      expect(response.status).toBe(503);
      expect(response.body.checks.supabase).toBe("failed");
      expect(mocks.fetchImpl).not.toHaveBeenCalled();
    });

    it("runs the other checks even when one fails", async () => {
      mocks.queryRaw.mockRejectedValue(new Error("db down"));
      mocks.ping.mockRejectedValue(new Error("redis down"));
      mocks.fetchImpl.mockRejectedValue(new Error("auth down"));

      const response = await authed(createTestApp());

      expect(response.status).toBe(503);
      expect(response.body.checks).toEqual({
        database: "failed",
        redis: "failed",
        supabase: "failed",
      });
      expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
      expect(mocks.ping).toHaveBeenCalledTimes(1);
      expect(mocks.fetchImpl).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(3);
    });

    it("never logs the token, a connection string, or a credentialed URL", async () => {
      mocks.queryRaw.mockRejectedValue(
        Object.assign(new Error(`bad ${secretNoise}`), { code: "P1001" }),
      );
      mocks.ping.mockRejectedValue(new Error(`bad ${secretNoise}`));
      mocks.fetchImpl.mockRejectedValue(
        new TypeError(`bad https://user:pw@${SUPABASE_URL}?apikey=${SUPABASE_KEY}`),
      );

      await authed(createTestApp());

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).not.toContain("hunter2");
      expect(logged).not.toContain("postgresql://");
      expect(logged).not.toContain(TOKEN);
      expect(logged).not.toContain(SUPABASE_KEY);
      expect(logged).not.toContain("user:pw");
      expect(logged).toContain("P1001");
    });
  });

  describe("timeouts", () => {
    it("reports a check that never resolves as failed without hanging", async () => {
      mocks.queryRaw.mockReturnValue(new Promise(() => {}));
      mocks.ping.mockReturnValue(new Promise(() => {}));
      mocks.fetchImpl.mockReturnValue(new Promise(() => {}));

      const started = Date.now();
      const response = await authed(createTestApp({ timeoutMs: 20 }));
      const elapsed = Date.now() - started;

      expect(response.status).toBe(503);
      expect(response.body.checks).toEqual({
        database: "failed",
        redis: "failed",
        supabase: "failed",
      });
      expect(elapsed).toBeLessThan(900);
    });

    it("times out a hanging dependency while the others still report ok", async () => {
      mocks.fetchImpl.mockReturnValue(new Promise(() => {}));

      const response = await authed(createTestApp({ timeoutMs: 20 }));

      expect(response.status).toBe(503);
      expect(response.body.checks).toEqual({
        database: "ok",
        redis: "ok",
        supabase: "failed",
      });
    });

    it("aborts the Supabase request when it times out", async () => {
      let signal: AbortSignal | undefined;
      mocks.fetchImpl.mockImplementation((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise(() => {});
      });

      await authed(createTestApp({ timeoutMs: 20 }));

      expect(signal?.aborted).toBe(true);
    });
  });
});
