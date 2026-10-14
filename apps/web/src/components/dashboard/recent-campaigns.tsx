import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { campaignHref, formatDate } from "@/lib/dashboard";
import { channelLabel } from "@/lib/campaignStatus";
import type { DashboardCampaign } from "@/lib/types";
import { Panel } from "./panel";

export function RecentCampaigns({
  businessId,
  campaigns,
}: {
  businessId: string;
  campaigns: DashboardCampaign[];
}) {
  return (
    <Panel id="recent-heading" title="Recent campaigns">
      {campaigns.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No campaigns yet. Your latest campaigns will show up here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 first:pt-0 last:pb-0"
            >
              <Link
                href={campaignHref(businessId, campaign)}
                className="inline-flex min-h-10 min-w-0 flex-[1_1_10rem] items-center text-sm font-medium text-ink hover:underline"
              >
                <span className="truncate">{campaign.title}</span>
              </Link>
              <CampaignStatusBadge status={campaign.status} />
              <span className="text-[13px] text-muted">{channelLabel(campaign.channel)}</span>
              <time dateTime={campaign.createdAt} className="text-[13px] text-muted">
                {formatDate(campaign.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
