import { rowActionsFor } from "./campaignDisplay";
import { CAMPAIGN_LIMITS } from "./campaignLimits";
import { displayStatusOf } from "./campaignStatus";
import { formatDateTime } from "./schedule";
import type { Campaign, CampaignPreviewResponse, MessageLog } from "./types";

export type DetailSegment = "preview" | "analytics" | "logs";

export const DETAIL_TABS: ReadonlyArray<{ segment: DetailSegment; label: string }> = [
  { segment: "preview", label: "Audience" },
  { segment: "analytics", label: "Results" },
  { segment: "logs", label: "Delivery log" },
];

export function detailHref(
  businessId: string,
  campaignId: string,
  segment?: DetailSegment | "edit" | "send",
): string {
  const base = `/businesses/${businessId}/campaigns/${campaignId}`;
  return segment ? `${base}/${segment}` : base;
}

/** Drafts open on the audience; everything else opens on the results. */
export function defaultDetailSegment(status: Campaign["status"]): "preview" | "analytics" {
  return status === "DRAFT" ? "preview" : "analytics";
}

/** Draft-only actions; an SMS draft (SMS is paused) can only be deleted. Send shares the edit permission (email drafts only). */
export function headerActionsFor(campaign: Pick<Campaign, "status" | "channel">): {
  edit: boolean;
  send: boolean;
  remove: boolean;
} {
  const actions = rowActionsFor(campaign);
  return {
    edit: actions.includes("edit"),
    send: actions.includes("edit"),
    remove: actions.includes("delete"),
  };
}

export function audienceIntro(
  campaign: Pick<Campaign, "status">,
  summary: Pick<CampaignPreviewResponse["summary"], "isSnapshot">,
): string {
  if (campaign.status === "DRAFT") {
    return "This is who would receive the campaign right now. It’s checked again when you send.";
  }
  if (summary.isSnapshot) {
    return "These are the recipients that were fixed when the campaign was queued.";
  }
  return "This is an older campaign without a saved recipient list, so this shows how your customers would be matched today.";
}

export function resultsNotes(
  campaign: Pick<Campaign, "status" | "sendAt">,
  now: Date = new Date(),
  timeZone?: string,
): string[] {
  const notes: string[] = [];
  const key = displayStatusOf(campaign, now);

  if (key === "SCHEDULED" && campaign.sendAt) {
    notes.push(
      `This campaign is scheduled for ${formatDateTime(campaign.sendAt, timeZone)}. Results appear once it starts sending.`,
    );
  } else if (key === "QUEUED") {
    notes.push("This campaign is queued and waiting to be sent. Results appear as messages go out.");
  } else if (key === "FAILED") {
    notes.push("This campaign didn’t finish sending.");
  }

  notes.push(
    "Delivery happens in the background, so these numbers can lag behind. Daily sending limits can mark some recipients as failed; the delivery log gives the reason for each.",
  );
  return notes;
}

export const LEGACY_ANALYTICS_NOTE =
  "This is an older campaign without a saved recipient list, so these numbers are estimated from its message logs.";

/** The sending limits that can make a delivery fail, for the Delivery log's explanation. */
export function sendLimitNotes(): string[] {
  const {
    maxEmailsPerRecipientPer24Hours,
    maxEmailsPerAccountPer24Hours,
    maxEmailsPerPlatformPer24Hours,
  } = CAMPAIGN_LIMITS;

  return [
    `Each customer can receive ${maxEmailsPerRecipientPer24Hours === 1 ? "one" : maxEmailsPerRecipientPer24Hours} campaign email every 24 hours.`,
    `Your account can send up to ${maxEmailsPerAccountPer24Hours} campaign emails every 24 hours.`,
    `DireConnect as a whole can send up to ${maxEmailsPerPlatformPer24Hours} campaign emails every 24 hours.`,
  ];
}

export function logStatusMeta(status: MessageLog["status"]): {
  label: string;
  tone: "success" | "danger" | "warning";
  icon: "check" | "alert" | "clock";
} {
  switch (status) {
    case "SENT":
      return { label: "Sent", tone: "success", icon: "check" };
    case "FAILED":
      return { label: "Failed", tone: "danger", icon: "alert" };
    default:
      return { label: "Pending", tone: "warning", icon: "clock" };
  }
}

/** Failure reasons keep the worker's own wording (it is already plain language), most common first. */
export function failureReasons(
  failedByReason: Record<string, number>,
): Array<{ label: string; count: number }> {
  return Object.entries(failedByReason)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** One sentence naming why messages failed, for the top of the Results tab. */
export function failureHeadline(failedByReason: Record<string, number>): string | null {
  const reasons = failureReasons(failedByReason);
  if (reasons.length === 0) {
    return null;
  }
  const total = reasons.reduce((sum, reason) => sum + reason.count, 0);
  const top = reasons[0];
  if (reasons.length === 1) {
    return `Messages failed because: ${top.label} (${top.count} of ${total}).`;
  }
  return `Most common failure reason: ${top.label} (${top.count} of ${total} failed messages).`;
}
