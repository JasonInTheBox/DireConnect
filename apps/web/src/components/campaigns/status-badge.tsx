import { Badge } from "@/components/ui/badge";
import { campaignStatusMeta } from "@/lib/campaignStatus";
import type { CampaignStatus } from "@/lib/types";

/** Draft, Queued, Sent or Failed: always an icon plus a word, never colour alone. */
export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const meta = campaignStatusMeta(status);

  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
