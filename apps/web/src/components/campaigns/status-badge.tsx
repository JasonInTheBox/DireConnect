import { Badge } from "@/components/ui/badge";
import { displayStatusMeta, displayStatusOf } from "@/lib/campaignStatus";
import type { CampaignStatus } from "@/lib/types";

/**
 * Draft, Queued, Scheduled, Sent or Failed: always an icon plus a word, never colour alone.
 * Pass `sendAt` when it is known (the campaign list) so a queued campaign with a future time
 * reads Scheduled; the dashboard payload has no send time and passes only the status.
 */
export function CampaignStatusBadge({
  status,
  sendAt,
}: {
  status: CampaignStatus;
  sendAt?: string | null;
}) {
  const meta = displayStatusMeta(displayStatusOf({ status, sendAt }));

  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}
