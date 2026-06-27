import { beforeEach, describe, expect, it, vi } from "vitest";
import { processCampaignJob } from "./campaignWorker.ts";

const mocks = {
  campaignFindFirst: vi.fn(),
  campaignUpdateMany: vi.fn(),
  messageLogCreate: vi.fn(),
  sendMessage: vi.fn(),
  emailHtmlBuilder: vi.fn(),
};

function createMockDb() {
  return {
    campaign: {
      findFirst: mocks.campaignFindFirst,
      updateMany: mocks.campaignUpdateMany,
    },
    messageLog: {
      create: mocks.messageLogCreate,
    },
  };
}

const baseJobData = {
  campaignId: "campaign-1",
  businessId: "business-1",
  ownerId: "user-1",
};

const baseCampaign = {
  id: "campaign-1",
  ownerId: "user-1",
  businessId: "business-1",
  title: "Summer Promo",
  message: "Hello customers",
  channel: "EMAIL",
  targetAudience: "EMAIL_OPTED_IN",
  status: "QUEUED",
  sendAt: null,
  business: {
    id: "business-1",
    name: "Jason's Test Business",
    website: "https://example.com",
  },
  recipientSnapshots: [],
};

describe("processCampaignJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.emailHtmlBuilder.mockReturnValue("<p>Hello customers</p>");
  });

  it("sends a message to an eligible email recipient and creates a SENT log", async () => {
    mocks.campaignFindFirst.mockResolvedValue({
      ...baseCampaign,
      recipientSnapshots: [
        {
          customerId: "customer-1",
          recipient: "alice@example.com",
          eligible: true,
          reason: null,
          unsubscribeTokenAtQueue: "token-1",
        },
      ],
    });

    mocks.sendMessage.mockResolvedValue({
      success: true,
    });

    const result = await processCampaignJob(baseJobData, {
      db: createMockDb() as any,
      messageSender: mocks.sendMessage,
      emailHtmlBuilder: mocks.emailHtmlBuilder,
      appUrl: "http://localhost:4000",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result.processed).toBe(true);
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(0);

    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "EMAIL",
        recipient: "alice@example.com",
        subject: "Summer Promo",
        message:
          "Hello customers\n\nUnsubscribe: http://localhost:4000/api/unsubscribe/token-1",
        htmlMessage: "<p>Hello customers</p>",
      }),
    );

    expect(mocks.messageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        businessId: "business-1",
        campaignId: "campaign-1",
        customerId: "customer-1",
        channel: "EMAIL",
        recipient: "alice@example.com",
        status: "SENT",
        errorMessage: null,
        sentAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    });

    expect(mocks.campaignUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "campaign-1",
        businessId: "business-1",
        ownerId: "user-1",
        status: "QUEUED",
      },
      data: {
        status: "SENT",
      },
    });
  });

  it("does not send to an ineligible snapshot and creates a FAILED log", async () => {
    mocks.campaignFindFirst.mockResolvedValue({
      ...baseCampaign,
      recipientSnapshots: [
        {
          customerId: "customer-1",
          recipient: "alice@example.com",
          eligible: false,
          reason: "Customer has not opted in to EMAIL",
          unsubscribeTokenAtQueue: "token-1",
        },
      ],
    });

    const result = await processCampaignJob(baseJobData, {
      db: createMockDb() as any,
      messageSender: mocks.sendMessage,
      emailHtmlBuilder: mocks.emailHtmlBuilder,
      appUrl: "http://localhost:4000",
    });

    expect(result.processed).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(1);

    expect(mocks.sendMessage).not.toHaveBeenCalled();

    expect(mocks.messageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer-1",
        recipient: "alice@example.com",
        status: "FAILED",
        errorMessage: "Customer has not opted in to EMAIL",
        sentAt: null,
      }),
    });

    expect(mocks.campaignUpdateMany).toHaveBeenCalled();
  });

  it("creates a FAILED log when the message sender fails", async () => {
    mocks.campaignFindFirst.mockResolvedValue({
      ...baseCampaign,
      recipientSnapshots: [
        {
          customerId: "customer-1",
          recipient: "alice@example.com",
          eligible: true,
          reason: null,
          unsubscribeTokenAtQueue: "token-1",
        },
      ],
    });

    mocks.sendMessage.mockResolvedValue({
      success: false,
      errorMessage: "SES send failed",
    });

    const result = await processCampaignJob(baseJobData, {
      db: createMockDb() as any,
      messageSender: mocks.sendMessage,
      emailHtmlBuilder: mocks.emailHtmlBuilder,
      appUrl: "http://localhost:4000",
    });

    expect(result.processed).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.skippedCount).toBe(0);

    expect(mocks.messageLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: "customer-1",
        recipient: "alice@example.com",
        status: "FAILED",
        errorMessage: "SES send failed",
        sentAt: null,
      }),
    });

    expect(mocks.campaignUpdateMany).toHaveBeenCalled();
  });

  it("skips processing when campaign is not found or not queued", async () => {
    mocks.campaignFindFirst.mockResolvedValue(null);

    const result = await processCampaignJob(baseJobData, {
      db: createMockDb() as any,
      messageSender: mocks.sendMessage,
      emailHtmlBuilder: mocks.emailHtmlBuilder,
      appUrl: "http://localhost:4000",
    });

    expect(result).toEqual({
      processed: false,
      reason: "Campaign not found or not QUEUED",
    });

    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.messageLogCreate).not.toHaveBeenCalled();
    expect(mocks.campaignUpdateMany).not.toHaveBeenCalled();
  });
});
