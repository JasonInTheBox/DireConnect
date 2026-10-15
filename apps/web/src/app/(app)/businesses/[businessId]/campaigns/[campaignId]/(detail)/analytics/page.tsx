"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Panel, PanelRow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import {
  detailHref,
  failureReasons,
  headerActionsFor,
  LEGACY_ANALYTICS_NOTE,
  resultsNotes,
} from "@/lib/campaignDetail";
import { skippedReasons } from "@/lib/campaignDisplay";
import type { CampaignAnalyticsResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignResultsPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { campaign, refetch: refetchCampaign, refreshing: campaignRefreshing } = useCampaign();
  const isDraft = campaign.status === "DRAFT";
  // A draft has nothing to report, so do not ask.
  const { data, error, loading, slow, refetch } = useApi<CampaignAnalyticsResponse>(
    isDraft ? null : `/api/businesses/${businessId}/campaigns/${campaignId}/analytics`,
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
  const refreshing = loading || campaignRefreshing;

  function refresh() {
    // Not disabled (that would drop keyboard focus), so ignore clicks while a reload is running.
    if (refreshing) {
      return;
    }
    refetch();
    refetchCampaign();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-prose space-y-1">
          {resultsNotes(campaign).map((note) => (
            <p key={note} className="text-sm text-muted">
              {note}
            </p>
          ))}
          {summary.analyticsSource === "LEGACY_LOGS" ? (
            <p className="text-sm text-ink">{LEGACY_ANALYTICS_NOTE}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span role="status" aria-live="polite" className="text-sm text-muted">
            {refreshing ? "Refreshing…" : ""}
          </span>
          <Button onClick={refresh} aria-disabled={refreshing || undefined}>
            <Icon name="clock" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-warning bg-warning-soft px-3 py-2 text-sm"
        >
          <p className="min-w-0 text-ink">Couldn’t refresh. Showing the earlier numbers.</p>
          <Button onClick={refresh}>Try again</Button>
        </div>
      ) : null}

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
