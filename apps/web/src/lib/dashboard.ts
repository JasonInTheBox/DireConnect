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
};

/** All three states (zeros included, for the legend), or nothing when no message exists. */
export function deliverySegments(
  messages: Pick<DashboardSummary["messages"], "sent" | "failed" | "pending">,
): DeliverySegment[] {
  const total = messages.sent + messages.failed + messages.pending;
  if (total <= 0) {
    return [];
  }

  const share = (count: number) => Math.round((count / total) * 1000) / 10;

  return [
    { key: "sent", label: "Sent", count: messages.sent, percent: share(messages.sent) },
    { key: "failed", label: "Failed", count: messages.failed, percent: share(messages.failed) },
    { key: "pending", label: "Pending", count: messages.pending, percent: share(messages.pending) },
  ];
}

export function successRateLabel(rate: number | null): string | null {
  return rate === null ? null : `${Math.round(rate)}% success rate`;
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

/** Drafts open in the preview; everything else opens the results view. */
export function campaignHref(
  businessId: string,
  campaign: Pick<DashboardCampaign, "id" | "status">,
): string {
  const section = campaign.status === "DRAFT" ? "preview" : "analytics";
  return `/businesses/${businessId}/campaigns/${campaign.id}/${section}`;
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
