import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { buttonClasses } from "@/components/ui/button";
import type { DashboardSummary } from "@/lib/types";
import { Panel, PanelRow } from "./panel";

export function CampaignsPanel({
  businessId,
  campaigns,
}: {
  businessId: string;
  campaigns: DashboardSummary["campaigns"];
}) {
  return (
    <Panel id="campaigns-heading" title="Campaigns" className="flex flex-col">
      <p className="mt-3">
        <span className="text-3xl font-semibold tracking-tight text-ink">{campaigns.total}</span>{" "}
        <span className="text-sm text-muted">{campaigns.total === 1 ? "campaign" : "campaigns"}</span>
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <PanelRow label={<CampaignStatusBadge status="DRAFT" />} value={campaigns.draft} />
        <PanelRow label={<CampaignStatusBadge status="QUEUED" />} value={campaigns.queued} />
        <PanelRow label={<CampaignStatusBadge status="SENT" />} value={campaigns.sent} />
        <PanelRow label={<CampaignStatusBadge status="FAILED" />} value={campaigns.failed} />
      </dl>

      <Link
        href={`/businesses/${businessId}/campaigns`}
        className={buttonClasses({ variant: "ghost", className: "-ml-3.5 mt-4 self-start" })}
      >
        View campaigns
      </Link>
    </Panel>
  );
}
