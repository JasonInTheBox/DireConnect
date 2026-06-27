import { describe, expect, it } from "vitest";
import { getCampaignEligibility } from "./campaignEligibility.ts";

const baseCustomer = {
  id: "customer-1",
  email: "alice@example.com",
  phone: "1234567890",
  emailOptIn: true,
  smsOptIn: true,
  unsubscribedAt: null,
};

describe("getCampaignEligibility", () => {
  it("marks an email customer eligible when they match audience, opted in, and have an email", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
      },
      {
        ...baseCustomer,
        emailOptIn: true,
        email: "alice@example.com",
      },
    );

    expect(result).toEqual({
      customerId: "customer-1",
      recipient: "alice@example.com",
      eligible: true,
      reason: null,
    });
  });

  it("marks an SMS customer eligible when they match audience, opted in, and have a phone", () => {
    const result = getCampaignEligibility(
      {
        channel: "SMS",
        targetAudience: "SMS_OPTED_IN",
      },
      {
        ...baseCustomer,
        smsOptIn: true,
        phone: "1234567890",
      },
    );

    expect(result).toEqual({
      customerId: "customer-1",
      recipient: "1234567890",
      eligible: true,
      reason: null,
    });
  });

  it("rejects a customer who does not match the campaign audience", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
      },
      {
        ...baseCustomer,
        emailOptIn: false,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe("alice@example.com");
    expect(result.reason).toBe(
      "Customer does not match campaign audience: EMAIL_OPTED_IN",
    );
  });

  it("rejects an email campaign customer who has not opted in to email", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "ALL",
      },
      {
        ...baseCustomer,
        emailOptIn: false,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe("alice@example.com");
    expect(result.reason).toBe("Customer has not opted in to EMAIL");
  });

  it("rejects an SMS campaign customer who has not opted in to SMS", () => {
    const result = getCampaignEligibility(
      {
        channel: "SMS",
        targetAudience: "ALL",
      },
      {
        ...baseCustomer,
        smsOptIn: false,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe("1234567890");
    expect(result.reason).toBe("Customer has not opted in to SMS");
  });

  it("rejects an unsubscribed customer even if they otherwise qualify", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
      },
      {
        ...baseCustomer,
        emailOptIn: true,
        unsubscribedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe("alice@example.com");
    expect(result.reason).toBe("Customer has unsubscribed");
  });

  it("rejects an email campaign customer with no email recipient", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "EMAIL_OPTED_IN",
      },
      {
        ...baseCustomer,
        emailOptIn: true,
        email: null,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe(null);
    expect(result.reason).toBe("Customer has no EMAIL recipient");
  });

  it("rejects an SMS campaign customer with no phone recipient", () => {
    const result = getCampaignEligibility(
      {
        channel: "SMS",
        targetAudience: "SMS_OPTED_IN",
      },
      {
        ...baseCustomer,
        smsOptIn: true,
        phone: null,
      },
    );

    expect(result.eligible).toBe(false);
    expect(result.recipient).toBe(null);
    expect(result.reason).toBe("Customer has no SMS recipient");
  });

  it("allows targetAudience ALL when the customer is opted into the selected channel", () => {
    const result = getCampaignEligibility(
      {
        channel: "EMAIL",
        targetAudience: "ALL",
      },
      {
        ...baseCustomer,
        emailOptIn: true,
      },
    );

    expect(result.eligible).toBe(true);
    expect(result.recipient).toBe("alice@example.com");
    expect(result.reason).toBe(null);
  });
});
