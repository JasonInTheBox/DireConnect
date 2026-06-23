"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type BusinessDashboard = {
  business: {
    id: string;
    name: string;
    description?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
  };
  summary: {
    customers: {
      total: number;
      emailOptedIn: number;
      smsOptedIn: number;
      unsubscribed: number;
    };
    campaigns: {
      total: number;
      draft: number;
      queued: number;
      sent: number;
      failed: number;
    };
    messages: {
      totalLogs: number;
      sent: number;
      failed: number;
      pending: number;
      successRate: number | null;
    };
  };
  recentCampaigns: {
    id: string;
    title: string;
    channel: "EMAIL" | "SMS";
    targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
    status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
    createdAt: string;
  }[];
};

type PageProps = {
  params: Promise<{
    businessId: string;
  }>;
};

export default function BusinessDashboardPage({ params }: PageProps) {
  const { businessId } = use(params);

  const [dashboard, setDashboard] = useState<BusinessDashboard | null>(null);

  async function fetchDashboard() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/dashboard`),
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to fetch dashboard");
      return;
    }

    const data: BusinessDashboard = await res.json();
    setDashboard(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (!dashboard) {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
        <div className="mx-auto max-w-6xl">
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {dashboard.business.name}
            </h1>
            <p className="mt-2 text-gray-400">
              Business dashboard overview for customers, campaigns, and message
              performance.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchDashboard}
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

        <div className="mb-6 flex flex-wrap gap-4">
          <Link
            href="/businesses"
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back to Businesses
          </Link>

          <Link
            href={`/businesses/${businessId}/customers`}
            className="text-sm font-medium text-green-400 hover:underline"
          >
            View Customers
          </Link>

          <Link
            href={`/businesses/${businessId}/campaigns`}
            className="text-sm font-medium text-purple-400 hover:underline"
          >
            View Campaigns
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Business Info</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-500">Description</p>
              <p className="mt-1 text-gray-200">
                {dashboard.business.description || "No description provided."}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Contact</p>
              <p className="mt-1 text-gray-200">
                {dashboard.business.email || "No email"}
              </p>
              <p className="text-gray-400">
                {dashboard.business.phone || "No phone"}
              </p>
              <p className="text-gray-400">
                {dashboard.business.website || "No website"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Customer Summary</h2>

          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard
              label="Total Customers"
              value={dashboard.summary.customers.total}
            />
            <SummaryCard
              label="Email Opted-In"
              value={dashboard.summary.customers.emailOptedIn}
            />
            <SummaryCard
              label="SMS Opted-In"
              value={dashboard.summary.customers.smsOptedIn}
            />
            <SummaryCard
              label="Unsubscribed"
              value={dashboard.summary.customers.unsubscribed}
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Campaign Summary</h2>

          <div className="grid gap-4 md:grid-cols-5">
            <SummaryCard
              label="Total Campaigns"
              value={dashboard.summary.campaigns.total}
            />
            <SummaryCard
              label="Draft"
              value={dashboard.summary.campaigns.draft}
            />
            <SummaryCard
              label="Queued"
              value={dashboard.summary.campaigns.queued}
            />
            <SummaryCard
              label="Sent"
              value={dashboard.summary.campaigns.sent}
            />
            <SummaryCard
              label="Failed"
              value={dashboard.summary.campaigns.failed}
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold">Message Summary</h2>

          <div className="grid gap-4 md:grid-cols-5">
            <SummaryCard
              label="Total Logs"
              value={dashboard.summary.messages.totalLogs}
            />
            <SummaryCard
              label="Sent Messages"
              value={dashboard.summary.messages.sent}
            />
            <SummaryCard
              label="Failed Messages"
              value={dashboard.summary.messages.failed}
            />
            <SummaryCard
              label="Pending Messages"
              value={dashboard.summary.messages.pending}
            />
            <SummaryCard
              label="Success Rate"
              value={
                dashboard.summary.messages.successRate === null
                  ? "N/A"
                  : `${dashboard.summary.messages.successRate}%`
              }
            />
          </div>
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Campaigns</h2>

            <Link
              href={`/businesses/${businessId}/campaigns`}
              className="text-sm font-medium text-blue-400 hover:underline"
            >
              View all
            </Link>
          </div>

          {dashboard.recentCampaigns.length === 0 ? (
            <p className="text-gray-400">No recent campaigns yet.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.recentCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-800 bg-gray-950 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-100">
                      {campaign.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Created {new Date(campaign.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-950 px-3 py-1 text-xs font-semibold text-blue-300">
                      {campaign.channel}
                    </span>

                    <span className="rounded-full bg-purple-950 px-3 py-1 text-xs font-semibold text-purple-300">
                      {campaign.targetAudience}
                    </span>

                    <span className="rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300">
                      {campaign.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-sm">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-100">{value}</p>
    </div>
  );
}
