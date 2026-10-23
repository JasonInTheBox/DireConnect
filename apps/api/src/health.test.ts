import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";

describe("GET /health", () => {
  it("returns API health status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("direconnect-api");
    expect(response.body.timestamp).toBeDefined();
  });
});

describe("GET /api/keepalive", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is mounted on the app and disabled when KEEPALIVE_TOKEN is unset", async () => {
    vi.stubEnv("KEEPALIVE_TOKEN", "");

    const response = await request(app)
      .get("/api/keepalive")
      .set("Authorization", "Bearer anything");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Not found" });
  });

  it("requires the bearer token when KEEPALIVE_TOKEN is set", async () => {
    vi.stubEnv("KEEPALIVE_TOKEN", "app-level-test-token");

    const response = await request(app).get("/api/keepalive");

    expect(response.status).toBe(401);
  });
});
