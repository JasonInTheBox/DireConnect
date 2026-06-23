"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type CampaignAnalytics = {
  campaign: {
    id: string;
    title: string;
    channel: "EMAIL" | "SMS";
    targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
    status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  };
  summary: {
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
};

type PageProps = {
  params: Promise<{
    businessId: string;
    campaignId: string;
  }>;
};

export default function CampaignAnalyticsPage({ params }: PageProps) {
  const { businessId, campaignId } = use(params);

  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);

  async function fetchAnalytics() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}/analytics`),
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to fetch campaign analytics");
      return;
    }

    const data = await res.json();
    setAnalytics(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (!analytics) {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
        <div className="mx-auto max-w-5xl">
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Campaign Analytics
            </h1>
            <p className="mt-2 text-gray-400">
              Review recipient, skipped, sent, and failed delivery results.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            Log out
          </button>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            href={`/businesses/${businessId}/campaigns`}
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back to Campaigns
          </Link>

          <Link
            href={`/businesses/${businessId}/campaigns/${campaignId}/preview`}
            className="text-sm font-medium text-purple-400 hover:underline"
          >
            View Preview
          </Link>

          <Link
            href={`/businesses/${businessId}/campaigns/${campaignId}/logs`}
            className="text-sm font-medium text-green-400 hover:underline"
          >
            View Logs
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">
            {analytics.campaign.title}
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            Channel: {analytics.campaign.channel} · Audience:{" "}
            {analytics.campaign.targetAudience} · Status:{" "}
            {analytics.campaign.status}
          </p>

          {analytics.summary.analyticsSource === "LEGACY_LOGS" && (
            <p className="mt-4 rounded-lg border border-yellow-900 bg-yellow-950 px-4 py-3 text-sm text-yellow-200">
                This is an older campaign without a frozen recipient snapshot. Analytics are
                estimated from existing message logs.
            </p>
          )}
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">
                {analytics.summary.analyticsSource === "SNAPSHOT"
                ? "Snapshot Customers"
                : "Logged Recipients"}
            </p>
            <p className="mt-2 text-3xl font-bold">
                {analytics.summary.totalRecipientCount}
            </p>
            </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Eligible at Queue</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {analytics.summary.eligibleCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Skipped Before Send</p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {analytics.summary.skippedBeforeSendCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Sent Rate</p>
            <p className="mt-2 text-3xl font-bold text-blue-400">
              {analytics.summary.sentRate === null
                ? "N/A"
                : `${analytics.summary.sentRate}%`}
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Attempted Sends</p>
            <p className="mt-2 text-3xl font-bold">
              {analytics.summary.attemptedSendCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Sent</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {analytics.summary.sentCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Send Failures</p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {analytics.summary.failedDeliveryCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Pending</p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">
              {analytics.summary.pendingCount}
            </p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Skipped Reasons</h2>

            {Object.keys(analytics.summary.skippedByReason).length === 0 ? (
              <p className="text-gray-400">No skipped customers.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(analytics.summary.skippedByReason).map(
                  ([reason, count]) => (
                    <li
                      key={reason}
                      className="flex justify-between gap-4 rounded-lg bg-gray-950 px-4 py-3 text-sm"
                    >
                      <span className="text-gray-300">{reason}</span>
                      <span className="font-semibold text-gray-100">
                        {count}
                      </span>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Send Failure Reasons</h2>

            {Object.keys(analytics.summary.failedByReason).length === 0 ? (
              <p className="text-gray-400">No send failures.</p>
            ) : (
              <ul className="space-y-2">
                {Object.entries(analytics.summary.failedByReason).map(
                  ([reason, count]) => (
                    <li
                      key={reason}
                      className="flex justify-between gap-4 rounded-lg bg-gray-950 px-4 py-3 text-sm"
                    >
                      <span className="text-gray-300">{reason}</span>
                      <span className="font-semibold text-gray-100">
                        {count}
                      </span>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
