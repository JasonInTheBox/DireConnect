import { describe, expect, it } from "vitest";
import { createCampaignSchema } from "./campaign.js";
import { z } from "zod";

describe("createCampaignSchema", () => {
  it("accepts a valid email campaign", () => {
    const result = createCampaignSchema.safeParse({
        title: "Summer Promo",
        message: "Hello customers, this is a test campaign.",
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
        sendAt: new Date("2099-01-01T00:00:00.000Z").toISOString(),
    });

    expect(result.success).toBe(true);
    });

  it("rejects an empty title", () => {
    const result = createCampaignSchema.safeParse({
      title: "",
      message: "Hello customers",
      channel: "EMAIL",
      targetAudience: "EMAIL_OPTED_IN",
      sendAt: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty message", () => {
    const result = createCampaignSchema.safeParse({
      title: "Test Campaign",
      message: "",
      channel: "EMAIL",
      targetAudience: "EMAIL_OPTED_IN",
      sendAt: null,
    });

    expect(result.success).toBe(false);
  });
});
