import Link from "next/link";
import { type RefObject } from "react";
import { RecipientSummary, type PreviewState } from "./recipient-summary";
import { Button, buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { SendBlock, SendFailure, WizardValues } from "@/lib/campaignWizard";
import { localTimeZoneLabel, toLocalInput } from "@/lib/schedule";

function TimingOption({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-control py-1 text-sm font-medium text-ink"
      >
        <input
          id={id}
          type="radio"
          name="timing"
          checked={checked}
          onChange={onChange}
          aria-describedby={`${id}-hint`}
          className="h-5 w-5 shrink-0 cursor-pointer accent-accent"
        />
        {label}
      </label>
      <p id={`${id}-hint`} className="pl-8 text-xs text-muted">
        {hint}
      </p>
    </div>
  );
}

export function StepReview({
  values,
  errors,
  onChange,
  preview,
  blocks,
  sendError,
  sendErrorRef,
  onRecheck,
}: {
  values: WizardValues;
  errors: Record<string, string>;
  onChange: <K extends keyof WizardValues>(key: K, value: WizardValues[K]) => void;
  preview: PreviewState;
  blocks: SendBlock[];
  sendError: SendFailure | null;
  sendErrorRef: RefObject<HTMLDivElement | null>;
  onRecheck: () => void;
}) {
  const canRecheck = blocks.some((block) => block.code !== "email-unconfirmed");

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

      <div aria-live="polite" className="space-y-2">
        {blocks.map((block) => (
          <div
            key={block.code}
            className="rounded-control border border-warning bg-warning-soft px-3 py-2.5 text-sm"
          >
            <p className="font-medium text-warning">{block.title}</p>
            <p className="mt-0.5 text-ink">{block.message}</p>
            {block.action ? (
              <Link
                href={block.action.href}
                className={buttonClasses({ variant: "secondary", className: "mt-2" })}
              >
                {block.action.label}
              </Link>
            ) : null}
          </div>
        ))}
        {canRecheck ? <Button onClick={onRecheck}>Check again</Button> : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-[13px] font-medium text-ink">When should it go out?</legend>
        <TimingOption
          id="timing-now"
          label="Send now"
          hint="It’s queued as soon as you confirm."
          checked={values.timing === "now"}
          onChange={() => onChange("timing", "now")}
        />
        <TimingOption
          id="timing-schedule"
          label="Schedule for later"
          hint="Choose a date and time in the future."
          checked={values.timing === "schedule"}
          onChange={() => onChange("timing", "schedule")}
        />
        {values.timing === "schedule" ? (
          <div className="pl-8">
            <TextField
              label="Date and time"
              type="datetime-local"
              required
              min={toLocalInput(new Date().toISOString())}
              value={values.scheduledAt}
              onChange={(event) => onChange("scheduledAt", event.target.value)}
              error={errors.scheduledAt}
              hint={`Times are shown in your time zone (${localTimeZoneLabel()}).`}
            />
          </div>
        ) : null}
      </fieldset>

      {sendError ? (
        <div
          ref={sendErrorRef}
          role="alert"
          tabIndex={-1}
          className="rounded-control border border-danger bg-danger-soft px-3 py-2.5 text-sm focus:outline-none"
        >
          <p className="font-medium text-danger">The campaign wasn’t sent</p>
          <p className="mt-0.5 text-ink">{sendError.message}</p>
          {sendError.draftSaved ? (
            <p className="mt-1 text-muted">
              Your draft is saved. Fix the problem and try again, or save the draft and come back
              later.
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-[13px] text-muted">
        Delivery happens in the background, and daily sending limits may mark some recipients as
        failed. You’ll see the results on the next screen.
      </p>
    </div>
  );
}
