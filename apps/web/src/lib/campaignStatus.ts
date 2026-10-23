import type { CampaignChannel, CampaignStatus } from "./types";

export type StatusTone = "neutral" | "accent" | "success" | "danger";
export type StatusIcon = "edit" | "send" | "check" | "alert" | "clock";

/** The API's four statuses plus Scheduled, which is a queued campaign with a future send time. */
export type DisplayStatus = CampaignStatus | "SCHEDULED";

const STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: "edit" },
  QUEUED: { label: "Queued", tone: "accent", icon: "send" },
  SENT: { label: "Sent", tone: "success", icon: "check" },
  FAILED: { label: "Failed", tone: "danger", icon: "alert" },
};

const DISPLAY_META: Record<DisplayStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  ...STATUS_META,
  SCHEDULED: { label: "Scheduled", tone: "accent", icon: "clock" },
};

/** Every status has its own icon as well as a colour, so it never relies on colour alone. */
export function campaignStatusMeta(status: CampaignStatus) {
  return STATUS_META[status];
}

export function displayStatusMeta(key: DisplayStatus) {
  return DISPLAY_META[key];
}

export function displayStatusOf(
  campaign: { status: CampaignStatus; sendAt?: string | null },
  now: Date = new Date(),
): DisplayStatus {
  if (campaign.status === "QUEUED" && campaign.sendAt) {
    const time = new Date(campaign.sendAt).getTime();
    if (!Number.isNaN(time) && time > now.getTime()) {
      return "SCHEDULED";
    }
  }
  return campaign.status;
}

export function channelLabel(channel: CampaignChannel): string {
  return channel === "SMS" ? "SMS" : "Email";
}
