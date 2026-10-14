"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CampaignTable } from "@/components/campaigns/campaign-table";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import { CAMPAIGNS_PAGE_SIZE } from "@/lib/campaignDisplay";
import { paginate } from "@/lib/customers";
import type { Campaign } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useCampaignDeliveries } from "@/lib/useCampaignDeliveries";

export default function CampaignsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so the page, an open dialog and the page number reset when the business changes.
  return <CampaignsView key={businessId} businessId={businessId} />;
}

function CampaignsView({ businessId }: { businessId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const newHref = `/businesses/${businessId}/campaigns/new`;
  const { data, error, slow, refetch } = useApi<Campaign[]>(
    `/api/businesses/${businessId}/campaigns`,
  );

  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<Campaign | null>(null);

  const campaigns = data ?? [];
  const visible = paginate(campaigns, page, CAMPAIGNS_PAGE_SIZE);
  const deliveries = useCampaignDeliveries(businessId, visible.items);

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns" },
        ]}
        title="Campaigns"
        description="Write, schedule and review the emails you send to your customers."
        actions={
          <Link href={newHref} className={buttonClasses({ variant: "primary" })}>
            <Icon name="plus" />
            New campaign
          </Link>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load campaigns" message={error.message} onRetry={refetch} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="send"
          title="No campaigns yet"
          description="Write your first email campaign and send it to customers who agreed to hear from you."
          action={
            <Link href={newHref} className={buttonClasses({ variant: "primary" })}>
              Create your first campaign
            </Link>
          }
        />
      ) : (
        <>
          <CampaignTable
            businessId={businessId}
            campaigns={visible.items}
            deliveries={deliveries}
            onEdit={(campaign) =>
              router.push(`/businesses/${businessId}/campaigns/${campaign.id}/edit`)
            }
            onDelete={setDeleting}
          />
          <Pagination
            page={visible.page}
            pageCount={visible.pageCount}
            from={visible.from}
            to={visible.to}
            total={visible.total}
            onPageChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete “${deleting?.title ?? "this campaign"}”?`}
        description="This removes the draft. This can’t be undone."
        confirmLabel="Delete campaign"
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${businessId}/campaigns/${deleting.id}`, {
            method: "DELETE",
          });
          refetch();
          toast.success("Campaign deleted");
        }}
      />
    </PageContainer>
  );
}
