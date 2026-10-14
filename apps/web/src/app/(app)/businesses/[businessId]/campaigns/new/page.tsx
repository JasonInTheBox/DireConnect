"use client";

import { useParams } from "next/navigation";
import { CampaignWizard } from "@/components/campaigns/wizard/campaign-wizard";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { PageContainer, PageHeader } from "@/components/ui/page-header";

export default function NewCampaignPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so a half-written campaign never leaks into another business.
  return <NewCampaignView key={businessId} businessId={businessId} />;
}

function NewCampaignView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Campaigns", href: `/businesses/${businessId}/campaigns` },
          { label: "New campaign" },
        ]}
        title="New campaign"
        description="Write a message and send it to customers who agreed to hear from you."
      />
      <CampaignWizard businessId={businessId} businessName={businessName} campaign={null} />
    </PageContainer>
  );
}
