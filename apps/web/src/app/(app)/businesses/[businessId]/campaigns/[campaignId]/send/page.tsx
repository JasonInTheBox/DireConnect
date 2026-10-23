"use client";

import { useParams } from "next/navigation";
import { EditCampaignView } from "@/components/campaigns/edit-campaign-view";

export default function SendCampaignPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  return (
    <EditCampaignView
      key={`${businessId}/${campaignId}`}
      businessId={businessId}
      campaignId={campaignId}
      mode="send"
    />
  );
}
