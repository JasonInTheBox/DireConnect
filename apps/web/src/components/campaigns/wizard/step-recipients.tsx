import Link from "next/link";
import { SlowNotice } from "@/components/ui/state";
import { CAMPAIGN_LIMITS } from "@/lib/campaignLimits";
import { pluralize } from "@/lib/format";

export function StepRecipients({
  businessId,
  optedInCount,
  loading,
  slow,
  failed,
}: {
  businessId: string;
  /** Customers who agreed to receive emails; null until the dashboard request answers. */
  optedInCount: number | null;
  loading: boolean;
  slow: boolean;
  failed: boolean;
}) {
  const { maxRecipientsPerCampaign, maxEmailsPerRecipientPer24Hours } = CAMPAIGN_LIMITS;

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink">
        Your campaign goes to customers who agreed to receive promotional emails, have an email
        address and haven’t unsubscribed. You don’t need to choose an audience.
      </p>

      <div aria-live="polite" className="space-y-2">
        {loading ? (
          <>
            <p className="text-sm text-muted">Counting your customers…</p>
            {slow ? <SlowNotice /> : null}
          </>
        ) : failed || optedInCount === null ? (
          <p className="text-sm text-muted">
            We couldn’t load your customer count. You’ll see exactly who receives the campaign on
            the last step.
          </p>
        ) : optedInCount === 0 ? (
          <div className="rounded-control border border-warning bg-warning-soft px-3 py-2.5 text-sm">
            <p className="font-medium text-warning">No customers have agreed to receive emails yet</p>
            <p className="mt-0.5 text-ink">
              You can still write this campaign, but it can’t be sent until a customer opts in.{" "}
              <Link
                href={`/businesses/${businessId}/customers`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline"
              >
                Add customers (opens in a new tab)
              </Link>
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink">
              <span className="font-semibold">{pluralize(optedInCount, "customer")}</span>{" "}
              {optedInCount === 1 ? "has" : "have"} agreed to receive emails. The exact list, minus
              anyone without an email address, is checked on the last step.
            </p>
            {optedInCount > maxRecipientsPerCampaign ? (
              <div className="rounded-control border border-warning bg-warning-soft px-3 py-2.5 text-sm">
                <p className="font-medium text-warning">
                  More customers opted in than one campaign can reach
                </p>
                <p className="mt-0.5 text-ink">
                  {optedInCount} customers have agreed to receive emails, but DireConnect limits each
                  campaign to {maxRecipientsPerCampaign} recipients while sending is in early access.
                  You can write the campaign now; sending will be blocked until it would reach{" "}
                  {maxRecipientsPerCampaign} or fewer.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div>
        <h3 className="text-[13px] font-medium text-ink">Sending limits</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
          <li>Up to {maxRecipientsPerCampaign} recipients per campaign.</li>
          <li>
            Each customer can receive {maxEmailsPerRecipientPer24Hours === 1 ? "one" : maxEmailsPerRecipientPer24Hours}{" "}
            campaign email per 24 hours.
          </li>
        </ul>
      </div>
    </div>
  );
}
