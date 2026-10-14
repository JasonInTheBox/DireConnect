export type Business = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type Customer = {
  id: string;
  ownerId: string;
  businessId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  unsubscribedAt?: string | null;
  createdAt?: string;
};

export type CampaignStatus = "DRAFT" | "QUEUED" | "SENT" | "FAILED";
export type CampaignChannel = "EMAIL" | "SMS";
export type CampaignAudience = "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";

export type DashboardSummary = {
  customers: { total: number; emailOptedIn: number; smsOptedIn: number; unsubscribed: number };
  campaigns: { total: number; draft: number; queued: number; sent: number; failed: number };
  messages: {
    totalLogs: number;
    sent: number;
    failed: number;
    pending: number;
    successRate: number | null;
  };
};

export type DashboardCampaign = {
  id: string;
  title: string;
  channel: CampaignChannel;
  targetAudience: CampaignAudience;
  status: CampaignStatus;
  createdAt: string;
};

export type DashboardResponse = {
  business: Business;
  summary: DashboardSummary;
  recentCampaigns: DashboardCampaign[];
};

export type Campaign = {
  id: string;
  ownerId: string;
  businessId: string;
  title: string;
  message: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  sendAt?: string | null;
  targetAudience: CampaignAudience;
  createdAt: string;
  updatedAt: string;
};

export type CampaignAnalyticsSummary = {
  analyticsSource: "SNAPSHOT" | "LEGACY_LOGS";
  hasSnapshot: boolean;
  totalSnapshotCount: number;
  totalRecipientCount: number;
  eligibleCount: number;
  skippedBeforeSendCount: number;
  attemptedSendCount: number;
  sentCount: number;
  failedDeliveryCount: number;
  pendingCount: number;
  totalLogCount: number;
  sentRate: number | null;
  skippedByReason: Record<string, number>;
  failedByReason: Record<string, number>;
};

export type CampaignAnalyticsResponse = {
  campaign: Pick<Campaign, "id" | "title" | "channel" | "targetAudience" | "status">;
  summary: CampaignAnalyticsSummary;
};

export type PreviewRecipient = {
  customerId: string;
  recipient: string | null;
  eligible: boolean;
  reason: string | null;
};

export type CampaignPreviewResponse = {
  campaign: Pick<Campaign, "id" | "title" | "channel" | "targetAudience" | "status">;
  summary: {
    totalCustomers: number;
    eligibleCount: number;
    skippedCount: number;
    skippedByReason: Record<string, number>;
    isSnapshot: boolean;
  };
  eligible: PreviewRecipient[];
  skipped: PreviewRecipient[];
};
