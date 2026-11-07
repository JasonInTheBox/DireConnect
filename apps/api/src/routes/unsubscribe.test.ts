import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUnsubscribeRouter } from "./unsubscribe.ts";

const mocks = { findUnique: vi.fn(), updateMany: vi.fn() };

function createTestApp() {
  const app = express();
  app.use(
    "/api/unsubscribe",
    createUnsubscribeRouter({ customer: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } as any),
  );
  return app;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("unsubscribe", () => {
  it("shows a confirm page on GET without unsubscribing", async () => {
    mocks.findUnique.mockResolvedValue({ id: "customer-1" });

    const res = await request(createTestApp()).get("/api/unsubscribe/token-1");

    expect(res.status).toBe(200);
    expect(res.text).toContain('<form method="post">');
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("answers 404 on GET for an unknown token", async () => {
    mocks.findUnique.mockResolvedValue(null);

    const res = await request(createTestApp()).get("/api/unsubscribe/nope");

    expect(res.status).toBe(404);
  });

  it("unsubscribes on POST, including one-click requests from the inbox", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(createTestApp())
      .post("/api/unsubscribe/token-1")
      .type("form")
      .send("List-Unsubscribe=One-Click");

    expect(res.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { unsubscribeToken: "token-1" },
      data: { emailOptIn: false, smsOptIn: false, unsubscribedAt: expect.any(Date) },
    });
  });

  it("answers 404 on POST for an unknown token", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const res = await request(createTestApp()).post("/api/unsubscribe/nope");

    expect(res.status).toBe(404);
  });
});
