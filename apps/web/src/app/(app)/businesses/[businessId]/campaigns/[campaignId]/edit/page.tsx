"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { editBlockReason } from "@/lib/campaignDisplay";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function EditCampaignPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  return <EditCampaignView key={`${businessId}/${campaignId}`} businessId={businessId} campaignId={campaignId} />;
}

function EditCampaignView({ businessId, campaignId }: { businessId: string; campaignId: string }) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const listHref = `/businesses/${businessId}/campaigns`;
  // The API has no single-campaign endpoint, so read the list and find the campaign.
  const { data, error, slow, refetch } = useApi<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
  const campaign = data?.find((item) => item.id === campaignId) ?? null;
  const blockReason = campaign ? editBlockReason(campaign) : null;

  const backLink = (
    <Link href={listHref} className={buttonClasses({ variant: "primary" })}>
      Back to campaigns
    </Link>
  );

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: listHref },
          { label: "Edit campaign" },
        ]}
        title="Edit campaign"
        description="Changes are saved to the draft. Nothing is sent until you confirm on the last step."
      />

      {data === null && error === null ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load the campaign" message={error.message} onRetry={refetch} />
      ) : !campaign ? (
        <EmptyState
          title="Campaign not found"
          description="This campaign doesn’t exist or was deleted."
          action={backLink}
        />
      ) : blockReason ? (
        <EmptyState icon="alert" title="This campaign can’t be edited" description={blockReason} action={backLink} />
      ) : (
        <CampaignWizard
          key={campaign.id}
          businessId={businessId}
          businessName={businessName}
          campaign={campaign}
        />
      )}
    </PageContainer>
  );
}
