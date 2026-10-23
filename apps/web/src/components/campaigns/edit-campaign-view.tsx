"use client";

import Link from "next/link";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { editBlockReason } from "@/lib/campaignDisplay";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const COPY = {
  edit: {
    title: "Edit campaign",
    description: "Changes are saved to the draft. Nothing is sent until you confirm on the last step.",
    initialStep: "basics" as const,
  },
  send: {
    title: "Review and send",
    description: "Check who will receive it, then choose when it goes out.",
    initialStep: "review" as const,
  },
};

/** The wizard for an existing draft: opened on the first step to edit, or on the last step to send. */
export function EditCampaignView({
  businessId,
  campaignId,
  mode,
}: {
  businessId: string;
  campaignId: string;
  mode: "edit" | "send";
}) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const listHref = `/businesses/${businessId}/campaigns`;
  const copy = COPY[mode];
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
          ...(campaign
            ? [{ label: campaign.title, href: `/businesses/${businessId}/campaigns/${campaign.id}` }]
            : []),
          { label: copy.title },
        ]}
        title={copy.title}
        description={copy.description}
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
          initialStep={copy.initialStep}
        />
      )}
    </PageContainer>
  );
}
