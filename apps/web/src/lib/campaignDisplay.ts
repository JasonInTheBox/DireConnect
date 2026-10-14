import { displayStatusOf } from "./campaignStatus";
import { formatDateTime } from "./schedule";
import type { Campaign, CampaignAnalyticsSummary } from "./types";

export const CAMPAIGNS_PAGE_SIZE = 25;

export type CampaignDelivery =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      summary: Pick<
        CampaignAnalyticsSummary,
        "eligibleCount" | "sentCount" | "failedDeliveryCount" | "pendingCount"
      >;
    };

/** The "When" column: the scheduled time, the send time, or why there is none yet. */
export function whenLabel(
  campaign: Pick<Campaign, "status" | "sendAt" | "updatedAt">,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const key = displayStatusOf(campaign, now);
  const sendAt = campaign.sendAt ? formatDateTime(campaign.sendAt, timeZone) : "";

  switch (key) {
    case "DRAFT": {
      // A send time that has already passed is not a plan: the draft opens as Send now.
      const planned = campaign.sendAt && new Date(campaign.sendAt).getTime() > now.getTime();
      return planned ? `Planned for ${sendAt}` : "Not scheduled";
    }
    case "QUEUED":
      return "Waiting to be sent";
    case "SCHEDULED":
      return sendAt;
    default:
      return sendAt || formatDateTime(campaign.updatedAt, timeZone);
  }
}

/** The "Delivery" column: how many of the eligible recipients were sent, failed or are pending. */
export function deliveryLabel(
  campaign: Pick<Campaign, "status">,
  delivery: CampaignDelivery | undefined,
): string {
  if (campaign.status === "DRAFT") {
    return "Not sent yet";
  }
  if (!delivery || delivery.status === "loading") {
    return "Loading…";
  }
  if (delivery.status === "error") {
    return "Unavailable";
  }

  const { eligibleCount, sentCount, failedDeliveryCount, pendingCount } = delivery.summary;
  if (eligibleCount + sentCount + failedDeliveryCount + pendingCount === 0) {
    return "No recipients";
  }

  const parts = [`${sentCount} of ${eligibleCount} sent`];
  if (failedDeliveryCount > 0) {
    parts.push(`${failedDeliveryCount} failed`);
  }
  if (pendingCount > 0) {
    parts.push(`${pendingCount} pending`);
  }
  return parts.join(", ");
}

export type RowAction = "edit" | "delete";

/** Only drafts can change; SMS drafts (SMS is paused) can only be deleted. */
export function rowActionsFor(campaign: Pick<Campaign, "status" | "channel">): RowAction[] {
  if (campaign.status !== "DRAFT") {
    return [];
  }
  return campaign.channel === "EMAIL" ? ["edit", "delete"] : ["delete"];
}

/** Why a campaign cannot be opened in the wizard, or null when it can. */
export function editBlockReason(campaign: Pick<Campaign, "status" | "channel">): string | null {
  if (campaign.channel === "SMS") {
    return "SMS sending is paused, so this campaign can’t be edited.";
  }
  if (campaign.status !== "DRAFT") {
    return "Queued and sent campaigns can’t be edited.";
  }
  return null;
}

/**
 * Plain wording for the API's skip reasons. The API stores "unsubscribed" for people who never
 * opted in, so "unsubscribed" and "not opted in" read as one reason.
 */
export function plainSkipReason(reason: string | null): string {
  if (!reason) {
    return "Not eligible";
  }
  if (reason === "Customer has unsubscribed" || reason.startsWith("Customer has not opted in")) {
    return "Hasn’t agreed to receive emails";
  }
  if (reason.startsWith("Customer has no ")) {
    return "No email address";
  }
  if (reason.startsWith("Customer does not match campaign audience")) {
    return "Not in this campaign’s audience";
  }
  return reason;
}

export function skippedReasons(
  skippedByReason: Record<string, number>,
): Array<{ label: string; count: number }> {
  const merged = new Map<string, number>();
  for (const [reason, count] of Object.entries(skippedByReason)) {
    const label = plainSkipReason(reason);
    merged.set(label, (merged.get(label) ?? 0) + count);
  }
  return [...merged.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
