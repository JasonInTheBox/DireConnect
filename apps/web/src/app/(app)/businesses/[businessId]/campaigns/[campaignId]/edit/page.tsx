"use client";

import { useParams } from "next/navigation";
import { EditCampaignView } from "@/components/campaigns/edit-campaign-view";

export default function EditCampaignPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  return (
    <EditCampaignView
      key={`${businessId}/${campaignId}`}
      businessId={businessId}
      campaignId={campaignId}
      mode="edit"
    />
  );
}
