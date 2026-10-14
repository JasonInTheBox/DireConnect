"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CampaignsPanel } from "@/components/dashboard/campaigns-panel";
import { CustomersPanel } from "@/components/dashboard/customers-panel";
import { DeliveryPanel } from "@/components/dashboard/delivery-panel";
import { RecentCampaigns } from "@/components/dashboard/recent-campaigns";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { setupSteps, showSetupChecklist } from "@/lib/dashboard";
import type { DashboardResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";
import { useFocusRescue } from "@/lib/useFocusRescue";

export default function DashboardPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so open dialogs reset when the business changes.
  return <DashboardView key={businessId} businessId={businessId} />;
}

function DashboardView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const { data, error, slow, refetch } = useApi<DashboardResponse>(
    `/api/businesses/${businessId}/dashboard`,
  );
  const [addingCustomer, setAddingCustomer] = useState(false);
  const arm = useFocusRescue(data);
  const businessName =
    data?.business.name ?? businesses.find((business) => business.id === businessId)?.name ?? "Business";

  const steps = data ? setupSteps(data.summary) : [];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Dashboard" },
        ]}
        title="Dashboard"
        description="How your customers and campaigns are doing."
        actions={
          <>
            <Link
              href={`/businesses/${businessId}/campaigns`}
              className={buttonClasses({ variant: "secondary" })}
            >
              New campaign
            </Link>
            <Button variant="primary" onClick={() => setAddingCustomer(true)}>
              <Icon name="plus" />
              Add customer
            </Button>
          </>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : data === null && error ? (
        <ErrorState
          title="Couldn’t load the dashboard"
          message={error.message}
          onRetry={refetch}
        />
      ) : data ? (
        <>
          {showSetupChecklist(steps) ? (
            <SetupChecklist
              businessId={businessId}
              steps={steps}
              onAddCustomer={() => setAddingCustomer(true)}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <CustomersPanel businessId={businessId} customers={data.summary.customers} />
            <CampaignsPanel businessId={businessId} campaigns={data.summary.campaigns} />
          </div>

          <div className="mt-4 space-y-4">
            <DeliveryPanel messages={data.summary.messages} />
            <RecentCampaigns businessId={businessId} campaigns={data.recentCampaigns} />
          </div>

          <p className="mt-6 text-sm text-muted">
            Need to change the name or contact details?{" "}
            <Link href="/businesses" className="font-medium text-accent hover:underline">
              Edit it on the Businesses page
            </Link>
            .
          </p>
        </>
      ) : null}

      <CustomerFormDialog
        open={addingCustomer}
        onClose={() => setAddingCustomer(false)}
        businessId={businessId}
        onSaved={() => {
          arm();
          refetch();
        }}
      />
    </PageContainer>
  );
}
