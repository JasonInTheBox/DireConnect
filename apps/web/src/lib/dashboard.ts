import type { DashboardCampaign, DashboardSummary } from "./types";

/**
 * The API's `unsubscribed` count includes customers who never opted in (creating a customer
 * without consent stores `unsubscribedAt`), so "not opted in" is derived from the totals.
 */
export function notOptedInCount(
  customers: Pick<DashboardSummary["customers"], "total" | "emailOptedIn">,
): number {
  return Math.max(0, customers.total - customers.emailOptedIn);
}

export type DeliverySegment = {
  key: "sent" | "failed" | "pending";
  label: string;
  count: number;
  percent: number;
  /** Display text for the share; never "0%" for a non-zero count nor "100%" for a partial one. */
  share: string;
};

/**
 * A percentage that cannot contradict the counts: "0%" and "100%" only when exact, and
 * "<1%" / ">99%" for the tiny and near-total shares that plain rounding would flatten.
 */
export function shareLabel(count: number, total: number): string {
  if (total <= 0 || count <= 0) {
    return "0%";
  }
  if (count >= total) {
    return "100%";
  }
  const percent = (count / total) * 100;
  if (percent < 0.5) {
    return "<1%";
  }
  if (percent >= 99.5) {
    return ">99%";
  }
  return `${Math.round(percent)}%`;
}

/** All three states (zeros included, for the legend), or nothing when no message exists. */
export function deliverySegments(
  messages: Pick<DashboardSummary["messages"], "sent" | "failed" | "pending">,
): DeliverySegment[] {
  const total = messages.sent + messages.failed + messages.pending;
  if (total <= 0) {
    return [];
  }

  const percent = (count: number) => Math.round((count / total) * 1000) / 10;
  const segment = (key: DeliverySegment["key"], label: string, count: number): DeliverySegment => ({
    key,
    label,
    count,
    percent: percent(count),
    share: shareLabel(count, total),
  });

  return [
    segment("sent", "Sent", messages.sent),
    segment("failed", "Failed", messages.failed),
    segment("pending", "Pending", messages.pending),
  ];
}

/**
 * Sent ÷ (sent + failed), computed here from the same counts the legend shows so the two can
 * never disagree. Pending messages have no outcome yet, so they are noted rather than counted.
 */
export function successRateLabel(
  messages: Pick<DashboardSummary["messages"], "sent" | "failed" | "pending">,
): string | null {
  const finished = messages.sent + messages.failed;
  if (finished <= 0) {
    return null;
  }
  const base = `${shareLabel(messages.sent, finished)} success rate`;
  return messages.pending > 0 ? `${base} (pending messages not counted)` : base;
}

export type SetupStep = {
  id: "customer" | "campaign";
  title: string;
  description: string;
  done: boolean;
};

export function setupSteps(summary: Pick<DashboardSummary, "customers" | "campaigns">): SetupStep[] {
  const { customers, campaigns } = summary;

  return [
    {
      id: "customer",
      title: "Add your first customer",
      description: "Only customers who agreed to receive emails will get your campaigns.",
      done: customers.total > 0,
    },
    {
      id: "campaign",
      title: "Send your first campaign",
      description: "Write a message and send it to the customers who opted in.",
      // A draft has not been sent: only queued, sent and failed campaigns count.
      done: campaigns.queued + campaigns.sent + campaigns.failed > 0,
    },
  ];
}

export function showSetupChecklist(steps: SetupStep[]): boolean {
  return steps.some((step) => !step.done);
}

/**
 * Email drafts open in the wizard (the legacy preview page queues in one click, with none of the
 * wizard's checks); SMS drafts, which cannot be edited, keep the preview; everything else opens
 * the results view.
 */
export function campaignHref(
  businessId: string,
  campaign: Pick<DashboardCampaign, "id" | "status" | "channel">,
): string {
  const base = `/businesses/${businessId}/campaigns/${campaign.id}`;
  if (campaign.status !== "DRAFT") {
    return `${base}/analytics`;
  }
  return campaign.channel === "EMAIL" ? `${base}/edit` : `${base}/preview`;
}

export function formatDate(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
