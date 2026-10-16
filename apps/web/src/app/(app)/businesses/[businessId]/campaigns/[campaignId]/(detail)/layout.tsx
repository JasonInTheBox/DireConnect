"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { CampaignProvider } from "@/components/campaigns/detail/campaign-context";
import { CampaignHeader } from "@/components/campaigns/detail/campaign-header";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { LinkTabs } from "@/components/ui/tabs";
import { DETAIL_TABS, detailHref } from "@/lib/campaignDetail";
import { pageTitle } from "@/lib/pageTitle";
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
  const { data, error, loading, slow, refetch } = useApi<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
  const campaign = data?.find((item) => item.id === campaignId) ?? null;

  // Until the campaign loads there is no header to name the page.
  const placeholderTitle = <title>{pageTitle("Campaign")}</title>;

  if (data === null && error === null) {
    return (
      <PageContainer>
        {placeholderTitle}
        <ListSkeleton rows={4} slow={slow} />
      </PageContainer>
    );
  }
  if (data === null && error) {
    return (
      <PageContainer>
        {placeholderTitle}
        <ErrorState title="Couldn’t load the campaign" message={error.message} onRetry={refetch} />
      </PageContainer>
    );
  }
  if (!campaign) {
    return (
      <PageContainer>
        {placeholderTitle}
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
    <CampaignProvider
      campaign={campaign}
      refetch={refetch}
      refreshing={loading}
      refreshError={error !== null}
    >
      <PageContainer>
        <CampaignHeader businessId={businessId} businessName={businessName} campaign={campaign} />
        {error ? (
          <div
            role="alert"
            className="-mt-3 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-warning bg-warning-soft px-3 py-2 text-sm"
          >
            <p className="min-w-0 text-ink">
              Couldn’t refresh the campaign. Showing the earlier details.
            </p>
            <Button onClick={refetch}>Try again</Button>
          </div>
        ) : null}
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
