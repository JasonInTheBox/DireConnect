import type { CampaignChannel, CampaignStatus } from "./types";

export type StatusTone = "neutral" | "accent" | "success" | "danger";
export type StatusIcon = "edit" | "send" | "check" | "alert";

const STATUS_META: Record<CampaignStatus, { label: string; tone: StatusTone; icon: StatusIcon }> = {
  DRAFT: { label: "Draft", tone: "neutral", icon: "edit" },
  QUEUED: { label: "Queued", tone: "accent", icon: "send" },
  SENT: { label: "Sent", tone: "success", icon: "check" },
  FAILED: { label: "Failed", tone: "danger", icon: "alert" },
};

/** Every status has its own icon as well as a colour, so it never relies on colour alone. */
export function campaignStatusMeta(status: CampaignStatus) {
  return STATUS_META[status];
}

export function channelLabel(channel: CampaignChannel): string {
  return channel === "SMS" ? "SMS" : "Email";
}
