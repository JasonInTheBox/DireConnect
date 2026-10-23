"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import { detailHref, headerActionsFor } from "@/lib/campaignDetail";
import { whenLabel } from "@/lib/campaignDisplay";
import { channelLabel } from "@/lib/campaignStatus";
import type { Campaign } from "@/lib/types";

export function CampaignHeader({
  businessId,
  businessName,
  campaign,
}: {
  businessId: string;
  businessName: string;
  campaign: Campaign;
}) {
  const router = useRouter();
  const toast = useToast();
  const { refetch } = useCampaign();
  const [deleting, setDeleting] = useState(false);
  const actions = headerActionsFor(campaign);
  const listHref = `/businesses/${businessId}/campaigns`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: listHref },
          { label: campaign.title },
        ]}
        title={campaign.title}
        actions={
          actions.send || actions.edit || actions.remove ? (
            <>
              {actions.send ? (
                <Link
                  href={detailHref(businessId, campaign.id, "send")}
                  className={buttonClasses({ variant: "primary" })}
                >
                  <Icon name="send" />
                  Review and send
                </Link>
              ) : null}
              {actions.edit ? (
                <Link
                  href={detailHref(businessId, campaign.id, "edit")}
                  className={buttonClasses({ variant: "secondary" })}
                >
                  <Icon name="edit" />
                  Edit
                </Link>
              ) : null}
              {actions.remove ? (
                <Button variant="secondary" onClick={() => setDeleting(true)}>
                  <Icon name="trash" />
                  Delete
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <section aria-label="Campaign summary" className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
          <Badge>{channelLabel(campaign.channel)}</Badge>
          <span className="text-muted">{whenLabel(campaign)}</span>
          {campaign.channel === "SMS" ? (
            <span className="text-muted">SMS sending is paused</span>
          ) : null}
        </div>
        <p className="line-clamp-3 max-w-prose whitespace-pre-wrap break-words text-sm text-muted">
          {campaign.message}
        </p>
      </section>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Delete “${campaign.title}”?`}
        description="This removes the draft. This can’t be undone."
        confirmLabel="Delete campaign"
        onConfirm={async () => {
          try {
            await apiFetch(`/api/businesses/${businessId}/campaigns/${campaign.id}`, {
              method: "DELETE",
            });
          } catch (error) {
            // The campaign may have been queued elsewhere; stop offering draft actions if so.
            refetch();
            throw error;
          }
          toast.success("Campaign deleted");
          router.push(listHref);
        }}
      />
    </>
  );
}
