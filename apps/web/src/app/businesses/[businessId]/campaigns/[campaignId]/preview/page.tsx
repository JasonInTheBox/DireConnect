"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type PreviewPerson = {
  customerId: string;
  recipient: string | null;
  eligible: boolean;
  reason: string | null;
};

type CampaignPreview = {
  campaign: {
    id: string;
    title: string;
    channel: "EMAIL" | "SMS";
    targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
    status: "DRAFT" | "QUEUED" | "SENT" | "FAILED";
  };
  summary: {
    totalCustomers: number;
    eligibleCount: number;
    skippedCount: number;
    skippedByReason: Record<string, number>;
  };
  eligible: PreviewPerson[];
  skipped: PreviewPerson[];
};

type PageProps = {
  params: Promise<{
    businessId: string;
    campaignId: string;
  }>;
};

export default function CampaignPreviewPage({ params }: PageProps) {
  const { businessId, campaignId } = use(params);

  const [preview, setPreview] = useState<CampaignPreview | null>(null);

  async function getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    };
  }

  async function fetchPreview() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}/preview`),
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      alert(errorData?.error || "Failed to fetch campaign preview");
      return;
    }

    const data = await res.json();
    setPreview(data);
  }

  async function handleQueue() {
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

    window.location.href = `/businesses/${businessId}/campaigns`;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchPreview();
  }, []);

  if (!preview) {
    return (
      <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
        <div className="mx-auto max-w-5xl">
          <p className="text-gray-400">Loading preview...</p>
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
              Campaign Preview
            </h1>
            <p className="mt-2 text-gray-400">
              Review the estimated audience before queueing this campaign.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-800 px-4 py-2 font-medium text-gray-100 hover:bg-gray-700"
          >
            Log out
          </button>
        </div>

        <div className="mb-6">
          <Link
            href={`/businesses/${businessId}/campaigns`}
            className="text-sm font-medium text-blue-400 hover:underline"
          >
            ← Back to Campaigns
          </Link>
        </div>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {preview.campaign.title}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Channel: {preview.campaign.channel} · Audience:{" "}
                {preview.campaign.targetAudience} · Status:{" "}
                {preview.campaign.status}
              </p>
            </div>

            {preview.campaign.status === "DRAFT" && (
              <button
                onClick={handleQueue}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Queue Campaign
              </button>
            )}
          </div>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Total Customers</p>
            <p className="mt-2 text-3xl font-bold">
              {preview.summary.totalCustomers}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Estimated Recipients</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {preview.summary.eligibleCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Skipped</p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {preview.summary.skippedCount}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">Skipped Reasons</h2>

          {Object.keys(preview.summary.skippedByReason).length === 0 ? (
            <p className="text-gray-400">No skipped customers.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(preview.summary.skippedByReason).map(
                ([reason, count]) => (
                  <li
                    key={reason}
                    className="flex justify-between rounded-lg bg-gray-950 px-4 py-3 text-sm"
                  >
                    <span className="text-gray-300">{reason}</span>
                    <span className="font-semibold text-gray-100">{count}</span>
                  </li>
                )
              )}
            </ul>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Eligible Recipients</h2>

            {preview.eligible.length === 0 ? (
              <p className="text-gray-400">No eligible recipients.</p>
            ) : (
              <ul className="space-y-3">
                {preview.eligible.map((person) => (
                  <li
                    key={person.customerId}
                    className="rounded-lg bg-gray-950 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-gray-100">
                      {person.recipient}
                    </p>
                    <p className="text-green-400">Eligible</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">Skipped Customers</h2>

            {preview.skipped.length === 0 ? (
              <p className="text-gray-400">No skipped customers.</p>
            ) : (
              <ul className="space-y-3">
                {preview.skipped.map((person) => (
                  <li
                    key={person.customerId}
                    className="rounded-lg bg-gray-950 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-gray-100">
                      {person.recipient ?? "Missing recipient"}
                    </p>
                    <p className="text-red-400">{person.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
