import { RecipientSummary, type PreviewState } from "./recipient-summary";
import type { WizardValues } from "@/lib/campaignWizard";

export function StepReview({
  values,
  preview,
}: {
  values: WizardValues;
  preview: PreviewState;
}) {
  return (
    <div className="space-y-6">
      <p className="rounded-control border border-line bg-sunken px-3 py-2 text-sm text-muted">
        We saved this campaign as a draft so we can check exactly who will receive it. It stays
        under Campaigns until you send or delete it.
      </p>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-[13px] font-medium text-ink">Subject</dt>
          <dd className="mt-0.5 break-words text-ink">{values.title.trim()}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-medium text-ink">Message</dt>
          <dd className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-muted">
            {values.message.trim()}
          </dd>
        </div>
      </dl>

      <RecipientSummary preview={preview} />
    </div>
  );
}
