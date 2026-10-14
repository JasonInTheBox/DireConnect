import { CAMPAIGN_LIMITS } from "./campaignLimits";
import { pluralize } from "./format";
import { isFutureIso, localInputToIso, toLocalInput, validateSchedule } from "./schedule";
import type { Campaign } from "./types";

export const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "recipients", label: "Recipients" },
  { id: "message", label: "Message" },
  { id: "review", label: "Review and send" },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];
export type SendTiming = "now" | "schedule";

export type WizardValues = {
  title: string;
  message: string;
  timing: SendTiming;
  /** A datetime-local value in the user's time zone; only used when `timing` is "schedule". */
  scheduledAt: string;
  /** New campaigns always send ALL; a legacy EMAIL_OPTED_IN draft keeps its value. */
  audience: "ALL" | "EMAIL_OPTED_IN";
};

export function wizardValues(
  campaign?: Pick<Campaign, "title" | "message" | "sendAt" | "targetAudience"> | null,
  now: Date = new Date(),
): WizardValues {
  const sendAt = campaign?.sendAt ?? null;
  // A send time that has already passed means "send now"; it is not an error on opening a draft.
  const scheduled = sendAt !== null && isFutureIso(sendAt, now);

  return {
    title: campaign?.title ?? "",
    message: campaign?.message ?? "",
    timing: scheduled ? "schedule" : "now",
    scheduledAt: scheduled && sendAt ? toLocalInput(sendAt) : "",
    audience: campaign?.targetAudience === "EMAIL_OPTED_IN" ? "EMAIL_OPTED_IN" : "ALL",
  };
}

export function validateStep(
  step: WizardStepId,
  values: WizardValues,
  now: Date = new Date(),
): Record<string, string> {
  if (step === "basics") {
    return values.title.trim() ? {} : { title: "Enter a campaign name." };
  }
  if (step === "message") {
    return values.message.trim() ? {} : { message: "Write the message your customers will read." };
  }
  if (step === "review" && values.timing === "schedule") {
    const error = validateSchedule(values.scheduledAt, now);
    return error ? { scheduledAt: error } : {};
  }
  return {};
}

export function canSaveDraft(values: WizardValues): boolean {
  return Boolean(values.title.trim() && values.message.trim());
}

/** The API body for POST/PUT. `sendAt: ""` clears the send time (send now). */
export function campaignPayload(values: WizardValues) {
  const sendAt = values.timing === "schedule" ? (localInputToIso(values.scheduledAt) ?? "") : "";

  return {
    title: values.title.trim(),
    message: values.message.trim(),
    channel: "EMAIL" as const,
    targetAudience: values.audience,
    sendAt,
  };
}

export type SendBlock = {
  code: "no-recipients" | "over-limit" | "email-unconfirmed";
  title: string;
  message: string;
};

/** Reasons the Send button must stay disabled, each explained in plain language. */
export function sendBlocks({
  eligibleCount,
  emailConfirmed,
}: {
  eligibleCount: number;
  emailConfirmed: boolean;
}): SendBlock[] {
  const max = CAMPAIGN_LIMITS.maxRecipientsPerCampaign;
  const blocks: SendBlock[] = [];

  if (eligibleCount <= 0) {
    blocks.push({
      code: "no-recipients",
      title: "No one can receive this campaign yet",
      message:
        "Campaigns go to customers who agreed to receive promotional emails and have an email address. Add or update customers, then check again.",
    });
  }

  if (eligibleCount > max) {
    blocks.push({
      code: "over-limit",
      title: "Too many recipients",
      message: `Campaigns are limited to ${pluralize(max, "recipient")} for now, and this one would reach ${eligibleCount}. Update your customers so ${max} or fewer can receive it, then check again.`,
    });
  }

  if (!emailConfirmed) {
    blocks.push({
      code: "email-unconfirmed",
      title: "Confirm your email address first",
      message:
        "Campaigns can only be sent from accounts with a confirmed email address. Open the confirmation email we sent you, then reload this page.",
    });
  }

  return blocks;
}

export function confirmCopy({
  recipientCount,
  timing,
  scheduledLabel,
}: {
  recipientCount: number;
  timing: SendTiming;
  scheduledLabel: string;
}): { title: string; description: string; confirmLabel: string } {
  const people = pluralize(recipientCount, "customer");
  const note = "Queued campaigns can’t be edited or cancelled.";

  if (timing === "schedule") {
    return {
      title: `Schedule for ${people}?`,
      description: `Your campaign will be sent on ${scheduledLabel}. ${note}`,
      confirmLabel: "Schedule campaign",
    };
  }

  return { title: `Send to ${people} now?`, description: note, confirmLabel: "Send now" };
}

export function submitLabel(timing: SendTiming): string {
  return timing === "schedule" ? "Schedule campaign" : "Send now";
}

export function successMessage(timing: SendTiming): string {
  return timing === "schedule" ? "Campaign scheduled" : "Campaign queued";
}
