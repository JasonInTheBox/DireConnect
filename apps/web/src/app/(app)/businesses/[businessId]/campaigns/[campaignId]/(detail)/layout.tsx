"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { CampaignProvider } from "@/components/campaigns/detail/campaign-context";
import { CampaignHeader } from "@/components/campaigns/detail/campaign-header";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { LinkTabs } from "@/components/ui/tabs";
import { DETAIL_TABS, detailHref } from "@/lib/campaignDetail";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CampaignDetailLayout({ children }: { children: ReactNode }) {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  // Keyed so a different campaign or business never shows the previous one's state.
  return (
    <CampaignDetailShell key={`${businessId}/${campaignId}`} businessId={businessId} campaignId={campaignId}>
      {children}
    </CampaignDetailShell>
  );
}

function CampaignDetailShell({
  businessId,
  campaignId,
  children,
}: {
  businessId: string;
  campaignId: string;
  children: ReactNode;
}) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  // The API has no single-campaign endpoint, so read the list and find the campaign.
  const { data, error, slow, refetch } = useApi<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
  const campaign = data?.find((item) => item.id === campaignId) ?? null;

  if (data === null && error === null) {
    return (
      <PageContainer>
        <ListSkeleton rows={4} slow={slow} />
      </PageContainer>
    );
  }
  if (data === null && error) {
    return (
      <PageContainer>
        <ErrorState title="Couldn’t load the campaign" message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }
  if (!campaign) {
    return (
      <PageContainer>
        <EmptyState
          title="Campaign not found"
          description="This campaign doesn’t exist or was deleted."
          action={
            <Link
              href={`/businesses/${businessId}/campaigns`}
              className={buttonClasses({ variant: "primary" })}
            >
              Back to campaigns
            </Link>
          }
        />
      </PageContainer>
    );
  }

  return (
    <CampaignProvider campaign={campaign} refetch={refetch}>
      <PageContainer>
        <CampaignHeader businessId={businessId} businessName={businessName} campaign={campaign} />
        <LinkTabs
          label="Campaign sections"
          items={DETAIL_TABS.map((tab) => ({
            href: detailHref(businessId, campaign.id, tab.segment),
            label: tab.label,
          }))}
        />
        <div className="mt-6">{children}</div>
      </PageContainer>
    </CampaignProvider>
  );
}
