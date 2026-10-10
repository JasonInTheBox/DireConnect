/** Conservative launch limits for live campaign email delivery. */
export const CAMPAIGN_EMAIL_SAFETY_LIMITS = {
  maxRecipientsPerCampaign: 10,
  maxEmailsPerAccountPer24Hours: 25,
  maxEmailsPerPlatformPer24Hours: 100,
  maxEmailsPerRecipientPer24Hours: 1,
} as const;

/**
 * Production campaign senders must be explicitly approved by Supabase user ID.
 * Store IDs, not email addresses, so changing an account email doesn't grant
 * or revoke sending access accidentally.
 */
export function isCampaignSenderApproved(
  ownerId: string,
  approvedSenderIds: string | undefined,
): boolean {
  return (approvedSenderIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(ownerId);
}
