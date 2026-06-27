import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCampaignRouter } from "./campaign.ts";

const mocks = {
  businessFindUnique: vi.fn(),

  campaignFindMany: vi.fn(),
  campaignCreate: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignUpdateMany: vi.fn(),

  customerFindMany: vi.fn(),

  campaignRecipientSnapshotFindMany: vi.fn(),
  campaignRecipientSnapshotDeleteMany: vi.fn(),
  campaignRecipientSnapshotCreateMany: vi.fn(),

  queueAdd: vi.fn(),
};

function createTestApp() {
  const fakeRequireAuth = (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "jason@example.com",
    };

    next();
  };

  const mockDb = {
    business: {
      findUnique: mocks.businessFindUnique,
    },
    campaign: {
      findMany: mocks.campaignFindMany,
      create: mocks.campaignCreate,
      findFirst: mocks.campaignFindFirst,
      updateMany: mocks.campaignUpdateMany,
    },
    customer: {
      findMany: mocks.customerFindMany,
    },
    campaignRecipientSnapshot: {
      findMany: mocks.campaignRecipientSnapshotFindMany,
      deleteMany: mocks.campaignRecipientSnapshotDeleteMany,
      createMany: mocks.campaignRecipientSnapshotCreateMany,
    },
  };

  const mockQueue = {
    add: mocks.queueAdd,
  };

  const campaignRouter = createCampaignRouter(
    mockDb as any,
    fakeRequireAuth,
    mockQueue as any,
  );

  const app = express();

  app.use(express.json());

  app.use("/businesses/:businessId/campaigns", campaignRouter);

  return app;
}

describe("campaign routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET /businesses/:businessId/campaigns returns campaigns for an owned business", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.campaignFindMany.mockResolvedValue([
      {
        id: "campaign-1",
        ownerId: "user-1",
        businessId: "business-1",
        title: "Summer Promo",
        message: "Hello customers",
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
        status: "DRAFT",
        sendAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const response = await request(createTestApp()).get(
      "/businesses/business-1/campaigns",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("campaign-1");
    expect(response.body[0].businessId).toBe("business-1");

    expect(mocks.businessFindUnique).toHaveBeenCalledWith({
      where: {
        id_ownerId: {
          id: "business-1",
          ownerId: "user-1",
        },
      },
    });

    expect(mocks.campaignFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: "business-1",
          ownerId: "user-1",
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    );
  });

  it("GET /businesses/:businessId/campaigns returns 404 when business is not owned", async () => {
    mocks.businessFindUnique.mockResolvedValue(null);

    const response = await request(createTestApp()).get(
      "/businesses/business-1/campaigns",
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Business not found");
    expect(mocks.campaignFindMany).not.toHaveBeenCalled();
  });

  it("POST /businesses/:businessId/campaigns creates a campaign for an owned business", async () => {
    const sendAt = "2099-01-01T00:00:00.000Z";

    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.campaignCreate.mockResolvedValue({
      id: "campaign-1",
      ownerId: "user-1",
      businessId: "business-1",
      title: "Summer Promo",
      message: "Hello customers",
      channel: "EMAIL",
      targetAudience: "EMAIL_OPTED_IN",
      status: "DRAFT",
      sendAt: new Date(sendAt),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const response = await request(createTestApp())
      .post("/businesses/business-1/campaigns")
      .send({
        title: "Summer Promo",
        message: "Hello customers",
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
        sendAt,
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toBe("campaign-1");
    expect(response.body.businessId).toBe("business-1");
    expect(response.body.ownerId).toBe("user-1");

    expect(mocks.campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId: "user-1",
          businessId: "business-1",
          title: "Summer Promo",
          message: "Hello customers",
          channel: "EMAIL",
          targetAudience: "EMAIL_OPTED_IN",
          sendAt: new Date(sendAt),
        }),
      }),
    );
  });

  it("POST /businesses/:businessId/campaigns rejects invalid campaign data", async () => {
    const response = await request(createTestApp())
      .post("/businesses/business-1/campaigns")
      .send({
        title: "",
        message: "",
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
        sendAt: "2099-01-01T00:00:00.000Z",
      });

    expect(response.status).toBe(400);
    expect(mocks.campaignCreate).not.toHaveBeenCalled();
  });

  it("GET /businesses/:businessId/campaigns/:campaignId/preview returns audience preview", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.campaignFindFirst.mockResolvedValue({
      id: "campaign-1",
      ownerId: "user-1",
      businessId: "business-1",
      title: "Summer Promo",
      message: "Hello customers",
      channel: "EMAIL",
      targetAudience: "EMAIL_OPTED_IN",
      status: "DRAFT",
      sendAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    mocks.campaignRecipientSnapshotFindMany.mockResolvedValue([]);

    mocks.customerFindMany.mockResolvedValue([
      {
        id: "customer-1",
        ownerId: "user-1",
        businessId: "business-1",
        firstName: "Alice",
        lastName: "Chen",
        email: "alice@example.com",
        phone: "1234567890",
        emailOptIn: true,
        smsOptIn: false,
        unsubscribedAt: null,
        unsubscribeToken: "token-1",
      },
      {
        id: "customer-2",
        ownerId: "user-1",
        businessId: "business-1",
        firstName: "Bob",
        lastName: "Lee",
        email: "bob@example.com",
        phone: "1234567890",
        emailOptIn: false,
        smsOptIn: false,
        unsubscribedAt: null,
        unsubscribeToken: "token-2",
      },
    ]);

    const response = await request(createTestApp()).get(
      "/businesses/business-1/campaigns/campaign-1/preview",
    );

    expect(response.status).toBe(200);
    expect(response.body.campaign.id).toBe("campaign-1");
    expect(response.body.summary.totalCustomers).toBe(2);
    expect(response.body.summary.eligibleCount).toBe(1);
    expect(response.body.summary.skippedCount).toBe(1);
    expect(response.body.summary.isSnapshot).toBe(false);
  });

  it("POST /businesses/:businessId/campaigns/:campaignId/queue queues a draft campaign", async () => {
    mocks.businessFindUnique.mockResolvedValue({
      id: "business-1",
      ownerId: "user-1",
      name: "Jason's Test Business",
    });

    mocks.campaignUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.campaignFindFirst.mockResolvedValue({
      id: "campaign-1",
      ownerId: "user-1",
      businessId: "business-1",
      title: "Summer Promo",
      message: "Hello customers",
      channel: "EMAIL",
      targetAudience: "EMAIL_OPTED_IN",
      status: "QUEUED",
      sendAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    mocks.customerFindMany.mockResolvedValue([
      {
        id: "customer-1",
        ownerId: "user-1",
        businessId: "business-1",
        firstName: "Alice",
        lastName: "Chen",
        email: "alice@example.com",
        phone: "1234567890",
        emailOptIn: true,
        smsOptIn: false,
        unsubscribedAt: null,
        unsubscribeToken: "token-1",
      },
    ]);

    mocks.campaignRecipientSnapshotDeleteMany.mockResolvedValue({
      count: 0,
    });

    mocks.campaignRecipientSnapshotCreateMany.mockResolvedValue({
      count: 1,
    });

    mocks.queueAdd.mockResolvedValue({
      id: "job-1",
    });

    const response = await request(createTestApp()).post(
      "/businesses/business-1/campaigns/campaign-1/queue",
    );

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Campaign queued successfully");
    expect(response.body.campaignId).toBe("campaign-1");

    expect(mocks.campaignUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "campaign-1",
          businessId: "business-1",
          ownerId: "user-1",
          status: "DRAFT",
        },
        data: {
          status: "QUEUED",
        },
      }),
    );

    expect(mocks.campaignRecipientSnapshotDeleteMany).toHaveBeenCalled();
    expect(mocks.campaignRecipientSnapshotCreateMany).toHaveBeenCalled();

    expect(mocks.queueAdd).toHaveBeenCalledWith(
      "send-campaign",
      {
        campaignId: "campaign-1",
        businessId: "business-1",
        ownerId: "user-1",
      },
      expect.objectContaining({
        delay: 0,
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: false,
      }),
    );
  });
});
