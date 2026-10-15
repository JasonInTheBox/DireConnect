import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { notOptedInCount } from "@/lib/dashboard";
import type { DashboardSummary } from "@/lib/types";
import { Panel, PanelRow } from "@/components/ui/panel";

export function CustomersPanel({
  businessId,
  customers,
}: {
  businessId: string;
  customers: DashboardSummary["customers"];
}) {
  return (
    <Panel id="customers-heading" title="Customers" className="flex flex-col">
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight text-ink">{customers.total}</span>{" "}
        <span className="text-sm text-muted">{customers.total === 1 ? "customer" : "customers"}</span>
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <PanelRow label="Opted in to email" value={customers.emailOptedIn} />
        <PanelRow label="Not opted in" value={notOptedInCount(customers)} />
      </dl>

      <Link
        href={`/businesses/${businessId}/customers`}
        className={buttonClasses({ variant: "ghost", className: "-ml-3.5 mt-4 self-start" })}
      >
        View customers
      </Link>
    </Panel>
  );
}
