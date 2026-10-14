/**
 * Mirrors CAMPAIGN_EMAIL_SAFETY_LIMITS in packages/validation/src/campaignSafety.ts.
 * apps/web does not depend on that package; campaignLimits.test.ts fails if the values drift.
 */
export const CAMPAIGN_LIMITS = {
  maxRecipientsPerCampaign: 10,
  maxEmailsPerRecipientPer24Hours: 1,
} as const;
