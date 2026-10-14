import { describe, expect, it } from "vitest";
// Imported by relative path on purpose: apps/web does not depend on the package, but the values must match.
import { CAMPAIGN_EMAIL_SAFETY_LIMITS } from "../../../../packages/validation/src/campaignSafety";
import { CAMPAIGN_LIMITS } from "./campaignLimits";

describe("CAMPAIGN_LIMITS", () => {
  it("mirrors the API's email safety limits", () => {
    expect(CAMPAIGN_LIMITS.maxRecipientsPerCampaign).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxRecipientsPerCampaign,
    );
    expect(CAMPAIGN_LIMITS.maxEmailsPerRecipientPer24Hours).toBe(
      CAMPAIGN_EMAIL_SAFETY_LIMITS.maxEmailsPerRecipientPer24Hours,
    );
  });
});
