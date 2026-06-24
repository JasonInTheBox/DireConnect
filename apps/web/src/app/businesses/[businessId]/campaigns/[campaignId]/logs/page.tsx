"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/api";

type MessageLog = {
  id: string;
  ownerId: string;
  businessId: string;
  campaignId: string;
  customerId?: string | null;
  channel: "EMAIL" | "SMS";
  recipient: string;
  status: "PENDING" | "SENT" | "FAILED";
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type PageProps = {
  params: Promise<{
    businessId: string;
    campaignId: string;
  }>;
};

export default function CampaignLogsPage({ params }: PageProps) {
  const { businessId, campaignId } = use(params);

  const [logs, setLogs] = useState<MessageLog[]>([]);

  async function fetchLogs() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch(
      apiUrl(`/api/businesses/${businessId}/campaigns/${campaignId}/logs`),
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.log("Fetch logs failed:", {
            status: res.status,
            errorData,
        });
        alert(errorData?.error || `Failed to fetch message logs. Status: ${res.status}`);
        return;
    }

    const data = await res.json();
    setLogs(data);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const sentCount = logs.filter((log) => log.status === "SENT").length;
  const failedCount = logs.filter((log) => log.status === "FAILED").length;

  return (
    <main className="min-h-screen bg-gray-950 px-6 py-8 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Message Logs</h1>
            <p className="mt-2 text-gray-400">
              Review fake-send results for this campaign.
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

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Total Logs</p>
            <p className="mt-2 text-3xl font-bold">{logs.length}</p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Sent</p>
            <p className="mt-2 text-3xl font-bold text-green-400">
              {sentCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm text-gray-400">Failed</p>
            <p className="mt-2 text-3xl font-bold text-red-400">
              {failedCount}
            </p>
          </div>
        </section>

        <section>
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-8 text-center text-gray-400">
              No message logs yet. Queue and process this campaign first.
            </div>
          ) : (
            <ul className="space-y-4">
              {logs.map((log) => (
                <li
                  key={log.id}
                  className="rounded-xl border border-gray-800 bg-gray-900 p-5 shadow-sm"
                >
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {log.recipient}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        Channel: {log.channel}
                      </p>
                    </div>

                    <span
                      className={
                        log.status === "SENT"
                          ? "rounded-full bg-green-950 px-3 py-1 text-xs font-semibold text-green-300"
                          : log.status === "FAILED"
                            ? "rounded-full bg-red-950 px-3 py-1 text-xs font-semibold text-red-300"
                            : "rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-300"
                      }
                    >
                      {log.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-400">
                    Sent at:{" "}
                    {log.sentAt
                      ? new Date(log.sentAt).toLocaleString()
                      : "Not sent"}
                  </p>

                  {log.errorMessage && (
                    <p className="mt-2 text-sm text-red-300">
                      Error: {log.errorMessage}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
