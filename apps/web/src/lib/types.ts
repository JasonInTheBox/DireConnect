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
