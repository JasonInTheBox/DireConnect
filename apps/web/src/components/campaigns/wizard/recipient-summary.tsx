import { Button } from "@/components/ui/button";
import { SlowNotice } from "@/components/ui/state";
import type { ApiError } from "@/lib/apiClient";
import { skippedReasons } from "@/lib/campaignDisplay";
import { pluralize } from "@/lib/format";
import type { CampaignPreviewResponse } from "@/lib/types";

export type PreviewState = {
  data: CampaignPreviewResponse | null;
  error: ApiError | null;
  loading: boolean;
  slow: boolean;
  refetch: () => void;
};

/** Exact recipients from the API's preview: who will receive the campaign and who is skipped, and why. */
export function RecipientSummary({ preview }: { preview: PreviewState }) {
  const { data, error, slow, refetch } = preview;

  return (
    <section aria-labelledby="recipients-summary-heading" className="space-y-3">
      <h3 id="recipients-summary-heading" className="text-sm font-semibold text-ink">
        Who will receive it
      </h3>

      <div aria-live="polite">
        {data ? (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              <span className="text-2xl font-semibold">{data.summary.eligibleCount}</span>{" "}
              {data.summary.eligibleCount === 1 ? "customer" : "customers"} will receive this
              campaign
            </p>

            {data.summary.skippedCount > 0 ? (
              <div>
                <p className="text-sm text-muted">
                  {pluralize(data.summary.skippedCount, "customer")} will be skipped:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
                  {skippedReasons(data.summary.skippedByReason).map((reason) => (
                    <li key={reason.label}>
                      {reason.label}: {reason.count}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-danger">
              Couldn’t check who will receive this campaign. {error.message}
            </p>
            <Button onClick={refetch}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted">Checking who can receive this campaign…</p>
            {slow ? <SlowNotice /> : null}
          </div>
        )}
      </div>
    </section>
  );
}
