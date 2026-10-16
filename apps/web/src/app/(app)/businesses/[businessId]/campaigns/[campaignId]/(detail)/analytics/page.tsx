"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { RefreshBar } from "@/components/campaigns/detail/refresh-bar";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { buttonClasses } from "@/components/ui/button";
import { Panel, PanelRow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import {
  detailHref,
  failureHeadline,
  failureReasons,
  headerActionsFor,
  LEGACY_ANALYTICS_NOTE,
  resultsNotes,
} from "@/lib/campaignDetail";
import { skippedReasons } from "@/lib/campaignDisplay";
import type { CampaignAnalyticsResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { AUTO_REFRESH_MS, shouldAutoRefresh, useAutoRefresh } from "@/lib/useAutoRefresh";
import { useManualRefresh, useReloadFailed } from "@/lib/useRefreshState";

export default function CampaignResultsPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { campaign, refetch: refetchCampaign, refreshing: campaignRefreshing } = useCampaign();
  const isDraft = campaign.status === "DRAFT";
  // A draft has nothing to report, so do not ask.
  const { data, error, loading, slow, refetch } = useApi<CampaignAnalyticsResponse>(
    isDraft ? null : `/api/businesses/${businessId}/campaigns/${campaignId}/analytics`,
  );

  const busy = loading || campaignRefreshing;
  const { manual, start } = useManualRefresh(busy);
  const reloadFailed = useReloadFailed(error !== null, loading);

  function refresh() {
    refetch();
    refetchCampaign();
  }

  // Only a click is announced; background reloads stay silent.
  function refreshByUser() {
    start();
    refresh();
  }

  // Hooks run before any early return. A tick is skipped while a reload is still running, so
  // slow responses never stack or cancel each other. When the campaign leaves the queue, read this
  // tab's data once more so the numbers match the new status.
  useAutoRefresh(
    shouldAutoRefresh({ status: campaign.status, visible: true }),
    () => {
      if (!busy) {
        refresh();
      }
    },
    AUTO_REFRESH_MS,
    refetch,
  );

  if (isDraft) {
    const canSend = headerActionsFor(campaign).send;
    return (
      <EmptyState
        icon="send"
        title="No results yet"
        description="Results appear here after the campaign is sent."
        action={
          canSend ? (
            <Link
              href={detailHref(businessId, campaign.id, "send")}
              className={buttonClasses({ variant: "primary" })}
            >
              Review and send
            </Link>
          ) : undefined
        }
      />
    );
  }

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the results" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const { summary } = data;
  const skipped = skippedReasons(summary.skippedByReason);
  const failures = failureReasons(summary.failedByReason);
  const headline = campaign.status === "FAILED" ? failureHeadline(summary.failedByReason) : null;

  return (
    <div className="space-y-4">
      <div className="max-w-prose space-y-1">
        {headline ? <p className="text-sm font-medium text-ink">{headline}</p> : null}
        {resultsNotes(campaign).map((note) => (
          <p key={note} className="text-sm text-muted">
            {note}
          </p>
        ))}
        {summary.analyticsSource === "LEGACY_LOGS" ? (
          <p className="text-sm text-ink">{LEGACY_ANALYTICS_NOTE}</p>
        ) : null}
      </div>

      <RefreshBar refreshing={manual} failed={reloadFailed} earlier="numbers" onRefresh={refreshByUser} />

      <DeliveryPanel
        messages={{
          totalLogs: summary.totalLogCount,
          sent: summary.sentCount,
          failed: summary.failedDeliveryCount,
          pending: summary.pendingCount,
          successRate: summary.sentRate,
        }}
        emptyText="No messages have gone out yet. They appear here as the campaign is delivered."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel id="results-recipients-heading" title="Recipients">
          <dl className="mt-3 space-y-2 text-sm">
            <PanelRow label="Customers checked" value={summary.totalRecipientCount} />
            <PanelRow label="Eligible when queued" value={summary.eligibleCount} />
            <PanelRow label="Skipped before sending" value={summary.skippedBeforeSendCount} />
          </dl>
        </Panel>

        <Panel id="results-skipped-heading" title="Why customers were skipped">
          {skipped.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No customers were skipped.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {skipped.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>

        <Panel id="results-failures-heading" title="Why messages failed">
          {failures.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No messages have failed.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {failures.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
