"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type Campaign = {
  id: string;
  ownerId: string;
  businessId: string;
  title: string;
  message: string;
  channel: "EMAIL" | "SMS";
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  sendAt?: string | null;
  targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
  createdAt: string;
  updatedAt: string;
};

type CampaignAnalyticsSummary = {
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

type CampaignAnalyticsResponse = {
  campaign: {
    id: string;
    title: string;
    channel: "EMAIL" | "SMS";
    targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
    status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  };
  summary: CampaignAnalyticsSummary;
};

type PageProps = {
  params: Promise<{
    businessId: string;
  }>;
};

export default function BusinessCampaignsPage({ params }: PageProps) {
  const { businessId } = use(params);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analyticsByCampaignId, setAnalyticsByCampaignId] = useState<
    Record<string, CampaignAnalyticsSummary>
  >({});

  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null
  );

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [sendAt, setSendAt] = useState("");
  const [targetAudience, setTargetAudience] = useState<
    "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN"
  >("ALL");

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      throw new Error("No active session");
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function fetchCampaignAnalytics(
    campaignId: string,
    accessToken: string
  ): Promise<CampaignAnalyticsSummary | null> {
    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}/analytics`),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const data: CampaignAnalyticsResponse = await res.json();

    return data.summary;
  }

  async function fetchCampaigns() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns`),
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to fetch campaigns");
      return;
    }

    const campaignsData: Campaign[] = await res.json();
    setCampaigns(campaignsData);

    const analyticsEntries = await Promise.all(
      campaignsData.map(async (campaign) => {
        const summary = await fetchCampaignAnalytics(
          campaign.id,
          session.access_token
        );

        return [campaign.id, summary] as const;
      })
    );

    const nextAnalyticsByCampaignId: Record<string, CampaignAnalyticsSummary> =
      {};

    for (const [campaignId, summary] of analyticsEntries) {
      if (summary) {
        nextAnalyticsByCampaignId[campaignId] = summary;
      }
    }

    setAnalyticsByCampaignId(nextAnalyticsByCampaignId);
  }

  function resetForm() {
    setEditingCampaignId(null);
    setTitle("");
    setMessage("");
    setChannel("EMAIL");
    setSendAt("");
    setTargetAudience("ALL");
  }

  function handleEdit(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setTitle(campaign.title);
    setMessage(campaign.message);
    setChannel(campaign.channel);
    setTargetAudience(campaign.targetAudience ?? "ALL");

    if (campaign.sendAt) {
      setSendAt(campaign.sendAt.slice(0, 16));
    } else {
      setSendAt("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const campaignData = {
      title,
      message,
      channel,
      sendAt,
      targetAudience,
    };

    const url = editingCampaignId
      ? apiUrl(`/api/businesses/${businessId}/campaigns/${editingCampaignId}`)
      : apiUrl(`/api/businesses/${businessId}/campaigns`);

    const method = editingCampaignId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(campaignData),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to save campaign");
      return;
    }

    resetForm();
    await fetchCampaigns();
  }

  async function handleQueue(campaignId: string) {
    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}/queue`),
      {
        method: "POST",
        headers: await getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to queue campaign");
      return;
    }

    await fetchCampaigns();
  }

  async function handleDelete(campaignId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this campaign?"
    );

    if (!confirmed) {
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}`),
      {
        method: "DELETE",
        headers: await getAuthHeaders(),
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to delete campaign");
      return;
    }

    await fetchCampaigns();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function getQueueButtonLabel(campaign: Campaign) {
    if (!campaign.sendAt) {
      return "Send Now";
    }

    const sendTime = new Date(campaign.sendAt).getTime();

    if (sendTime > Date.now()) {
      return "Schedule Campaign";
    }

    return "Send Now";
  }

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
            <p className="mt-2 text-gray-400">
              Create, queue, preview, and review promotional campaigns for this
              business.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchCampaigns}
              className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
            >
              Log out
            </button>
          </div>
        </div>

        <div className="mb-6">
          <Link
            href="/businesses"
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back to Businesses
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">
            {editingCampaignId ? "Edit Campaign" : "Create Campaign"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
              placeholder="Campaign title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <textarea
              className="min-h-32 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
              placeholder="Campaign message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />

            <div className="grid gap-4 md:grid-cols-3">
              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "EMAIL" | "SMS")
                }
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>

              <select
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                value={targetAudience}
                onChange={(e) =>
                  setTargetAudience(
                    e.target.value as
                      | "ALL"
                      | "EMAIL_OPTED_IN"
                      | "SMS_OPTED_IN"
                  )
                }
              >
                <option value="ALL">All eligible customers</option>
                <option value="EMAIL_OPTED_IN">
                  Email opted-in customers
                </option>
                <option value="SMS_OPTED_IN">SMS opted-in customers</option>
              </select>

              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-gray-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-900"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                {editingCampaignId ? "Update Campaign" : "Create Campaign"}
              </button>

              {editingCampaignId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg bg-gray-800 px-4 py-2 font-semibold text-gray-100 hover:bg-gray-700"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold">Your Campaigns</h2>

          {campaigns.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-gray-400">
              No campaigns yet. Create your first campaign above.
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => {
                const analytics = analyticsByCampaignId[campaign.id];

                return (
                  <div
                    key={campaign.id}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {campaign.title}
                        </h3>

                        <p className="mt-2 whitespace-pre-wrap text-gray-300">
                          {campaign.message}
                        </p>

                        {campaign.sendAt && (
                          <p className="mt-2 text-sm text-gray-500">
                            Scheduled for:{" "}
                            {new Date(campaign.sendAt).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-300">
                          {campaign.channel}
                        </span>

                        <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                          {campaign.status}
                        </span>

                        <span className="rounded-full bg-purple-950 px-3 py-1 text-xs font-semibold text-purple-300">
                          {campaign.targetAudience}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 p-4">
                      {!analytics ? (
                        <p className="text-sm text-gray-500">
                          Loading analytics...
                        </p>
                      ) : (
                        <>
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-200">
                              Quick Analytics
                            </p>

                            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                              {analytics.analyticsSource === "SNAPSHOT"
                                ? "Snapshot"
                                : "Legacy Logs"}
                            </span>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                            <div>
                              <p className="text-xs text-gray-500">Eligible</p>
                              <p className="text-lg font-bold text-green-400">
                                {analytics.eligibleCount}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">Sent</p>
                              <p className="text-lg font-bold text-blue-400">
                                {analytics.sentCount}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">Failed</p>
                              <p className="text-lg font-bold text-red-400">
                                {analytics.failedDeliveryCount}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">Skipped</p>
                              <p className="text-lg font-bold text-yellow-400">
                                {analytics.skippedBeforeSendCount}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500">
                                Sent Rate
                              </p>
                              <p className="text-lg font-bold text-purple-400">
                                {analytics.sentRate === null
                                  ? "N/A"
                                  : `${analytics.sentRate}%`}
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {campaign.status === "DRAFT" && (
                        <>
                          <button
                            onClick={() => handleQueue(campaign.id)}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            {getQueueButtonLabel(campaign)}
                          </button>

                          <button
                            onClick={() => handleEdit(campaign)}
                            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(campaign.id)}
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </>
                      )}

                      <Link
                        href={`/businesses/${businessId}/campaigns/${campaign.id}/preview`}
                        className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
                      >
                        View Preview
                      </Link>

                      <Link
                        href={`/businesses/${businessId}/campaigns/${campaign.id}/analytics`}
                        className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                      >
                        View Analytics
                      </Link>

                      <Link
                        href={`/businesses/${businessId}/campaigns/${campaign.id}/logs`}
                        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-700"
                      >
                        View Logs
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
