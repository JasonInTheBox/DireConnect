"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCampaign } from "@/components/campaigns/detail/campaign-context";
import { ListSkeleton } from "@/components/ui/skeleton";
import { defaultDetailSegment, detailHref } from "@/lib/campaignDetail";

/** Bookmarks and old links to the campaign itself land on Audience (drafts) or Results. */
export default function CampaignIndexPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const { campaign } = useCampaign();
  const router = useRouter();

  useEffect(() => {
    router.replace(detailHref(businessId, campaign.id, defaultDetailSegment(campaign.status)));
  }, [router, businessId, campaign.id, campaign.status]);

  return <ListSkeleton rows={2} />;
}
