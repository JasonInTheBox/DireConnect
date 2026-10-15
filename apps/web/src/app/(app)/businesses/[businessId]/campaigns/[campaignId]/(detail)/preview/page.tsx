"use client";

import { useParams } from "next/navigation";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { RecipientList } from "@/components/campaigns/detail/recipient-list";
import { Panel, PanelRow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { audienceIntro } from "@/lib/campaignDetail";
import { plainSkipReason, skippedReasons } from "@/lib/campaignDisplay";
import type { CampaignPreviewResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignAudiencePage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { campaign } = useCampaign();
  const { data, error, slow, refetch } = useApi<CampaignPreviewResponse>(
    `/api/businesses/${businessId}/campaigns/${campaignId}/preview`,
  );

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the audience" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const { summary } = data;
  const reasons = skippedReasons(summary.skippedByReason);

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-muted">{audienceIntro(campaign, summary)}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel id="audience-summary-heading" title="Summary">
          <dl className="mt-3 space-y-2 text-sm">
            <PanelRow label="Customers checked" value={summary.totalCustomers} />
            <PanelRow label="Will receive it" value={summary.eligibleCount} />
            <PanelRow label="Skipped" value={summary.skippedCount} />
          </dl>
        </Panel>

        <Panel id="audience-reasons-heading" title="Why customers were skipped">
          {reasons.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No customers were skipped.</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm">
              {reasons.map((reason) => (
                <PanelRow key={reason.label} label={reason.label} value={reason.count} />
              ))}
            </dl>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <RecipientList
          title="Recipients"
          emptyText="No customers can receive this campaign."
          items={data.eligible.map((person) => ({
            key: person.customerId,
            primary: person.recipient ?? "No email address",
          }))}
        />
        <RecipientList
          title="Skipped customers"
          emptyText="No customers were skipped."
          items={data.skipped.map((person) => ({
            key: person.customerId,
            primary: person.recipient ?? "No email address",
            secondary: plainSkipReason(person.reason),
          }))}
        />
      </div>
    </div>
  );
}
