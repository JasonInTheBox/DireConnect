import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBusinessRouter } from "./business.ts";

const mocks = vi.hoisted(() => ({
  businessFindMany: vi.fn(),
  businessCreate: vi.fn(),
}));

vi.mock("../middleware/requireAuth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "jason@example.com",
    };

    next();
  },
}));

function createTestApp() {
  const mockDb = {
    business: {
      findMany: mocks.businessFindMany,
      create: mocks.businessCreate,
    },
  };
  const businessRouter = createBusinessRouter(mockDb as any);
  const app = express();

  app.use(express.json());

  app.use("/businesses", businessRouter);
  app.use("/business", businessRouter);

  return app;
}

describe("business routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.businessFindMany.mockReset();
    mocks.businessCreate.mockReset();
  });

  it("GET /businesses returns businesses owned by the logged-in user", async () => {
    mocks.businessFindMany.mockResolvedValue([
      {
        id: "business-1",
        ownerId: "user-1",
        name: "Jason's Test Business",
        description: "Test description",
        email: "owner@example.com",
        phone: "1234567890",
        website: "https://example.com",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const app = createTestApp();

    const response = await request(app).get("/businesses");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("business-1");
    expect(response.body[0].ownerId).toBe("user-1");

    expect(mocks.businessFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ownerId: "user-1",
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    );
  });

  it("POST /business creates a business for the logged-in user", async () => {
    mocks.businessCreate.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
      description: "Test description",
      email: "owner@example.com",
      phone: "1234567890",
      website: "https://example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const app = createTestApp();

    const response = await request(app).post("/business").send({
      name: "Jason's Test Business",
      description: "Test description",
      email: "owner@example.com",
      phone: "1234567890",
      website: "https://example.com",
    });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("business-1");
    expect(response.body.ownerId).toBe("user-1");
    expect(response.body.name).toBe("Jason's Test Business");

    expect(mocks.businessCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "user-1",
          name: "Jason's Test Business",
          description: "Test description",
          email: "owner@example.com",
          phone: "1234567890",
          website: "https://example.com",
        }),
      }),
    );
  });

  it("POST /business rejects invalid business data", async () => {
    const app = createTestApp();

    const response = await request(app).post("/business").send({
      description: "Missing business name",
      email: "owner@example.com",
    });

    expect(response.status).toBe(400);
    expect(mocks.businessCreate).not.toHaveBeenCalled();
  });
});
