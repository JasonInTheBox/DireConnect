"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SendConfirmDialog } from "./send-confirm-dialog";
import { StepBasics } from "./step-basics";
import { StepMessage } from "./step-message";
import { StepRecipients } from "./step-recipients";
import { StepReview } from "./step-review";
import { WizardStepper } from "./stepper";
import { useSession } from "@/components/shell/session-provider";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import {
  campaignPayload,
  canSaveDraft,
  confirmCopy,
  sendBlocks,
  type SendFailure,
  submitLabel,
  successMessage,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardStepId,
  type WizardValues,
} from "@/lib/campaignWizard";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import { formatDateTime, localInputToIso } from "@/lib/schedule";
import type { Campaign, CampaignPreviewResponse, DashboardResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const COULD_NOT_CONFIRM =
  "We couldn’t confirm whether the campaign was sent. Check Campaigns before trying again.";
const CAMPAIGN_GONE =
  "We couldn’t find this campaign any more. Check Campaigns before trying again.";

/** Server field errors belong to the step that shows the field. */
const FIELD_STEP: Record<string, WizardStepId> = { title: "basics", message: "message" };

export function CampaignWizard({
  businessId,
  businessName,
  campaign,
  initialStep = "basics",
}: {
  businessId: string;
  businessName: string;
  /** The draft being edited, or null to create a new campaign. */
  campaign: Campaign | null;
  /** Edit mode can open on the Review step (the "Review and send" action). */
  initialStep?: WizardStepId;
}) {
  const router = useRouter();
  const toast = useToast();
  const listHref = `/businesses/${businessId}/campaigns`;

  const [values, setValues] = useState<WizardValues>(() => wizardValues(campaign));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(() =>
    Math.max(0, WIZARD_STEPS.findIndex((item) => item.id === initialStep)),
  );
  const [draftId, setDraftId] = useState<string | null>(campaign?.id ?? null);
  const [busy, setBusy] = useState<"draft" | "review" | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(stepIndex);
  // Set when a failed save wants focus on the first invalid field once its errors are on screen.
  const focusInvalidAfterRender = useRef(false);
  const session = useSession();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<SendFailure | null>(null);
  // Latched after a successful queue so nothing can act on the draft while navigation completes.
  const [sent, setSent] = useState(false);
  const sentRef = useRef(false);
  const sendErrorRef = useRef<HTMLDivElement>(null);

  const step = WIZARD_STEPS[stepIndex].id;
  const isReview = step === "review";

  const dashboard = useApi<DashboardResponse>(`/api/businesses/${businessId}/dashboard`);
  const preview = useApi<CampaignPreviewResponse>(
    isReview && draftId ? `/api/businesses/${businessId}/campaigns/${draftId}/preview` : null,
  );

  // Move focus to the new step's heading for keyboard and screen-reader users (not on first render).
  useEffect(() => {
    if (shownStep.current === stepIndex) {
      return;
    }
    shownStep.current = stepIndex;
    if (focusInvalidAfterRender.current) {
      // The invalid field takes focus instead (see the effect below).
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

  // After the render that shows server field errors (and the step that owns them), focus the field.
  useEffect(() => {
    if (!focusInvalidAfterRender.current) {
      return;
    }
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid || Object.keys(errors).length === 0) {
      focusInvalidAfterRender.current = false;
      invalid?.focus();
    }
  }, [errors, stepIndex]);

  // A refused send leaves a panel on the Review step; move focus there once it appears.
  useEffect(() => {
    if (sendError) {
      sendErrorRef.current?.focus();
    }
  }, [sendError]);

  const eligibleCount = preview.data?.summary.eligibleCount ?? null;
  const blocks =
    eligibleCount === null
      ? []
      : sendBlocks({ eligibleCount, emailConfirmed: session.emailConfirmed });
  const canSend = eligibleCount !== null && blocks.length === 0;
  const scheduledIso = localInputToIso(values.scheduledAt);

  function setField<K extends keyof WizardValues>(key: K, value: WizardValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  /** Creates the draft on first save, updates it afterwards. */
  async function persistDraft(): Promise<string> {
    const base = `/api/businesses/${businessId}/campaigns`;
    const saved = await apiFetch<Campaign>(draftId ? `${base}/${draftId}` : base, {
      method: draftId ? "PUT" : "POST",
      body: campaignPayload(values),
    });
    setDraftId(saved.id);
    return saved.id;
  }

  function reportSaveError(error: unknown) {
    const { fields, unmapped } = splitFieldErrors(fieldErrorsFromApiError(error), ["title", "message"]);
    const fieldNames = Object.keys(fields);

    if (fieldNames.length > 0) {
      setErrors(fields);
      const owner = FIELD_STEP[fieldNames[0]];
      const index = WIZARD_STEPS.findIndex((item) => item.id === owner);
      if (index >= 0) {
        setStepIndex(index);
      }
      focusInvalidAfterRender.current = true;
    }
    if (unmapped.length > 0) {
      setFormError(unmapped.join(" "));
    } else if (fieldNames.length === 0) {
      setFormError(
        error instanceof ApiError ? error.message : "Could not save the campaign. Try again.",
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || sentRef.current) {
      return;
    }

    if (isReview) {
      // The final action asks for confirmation first; nothing is sent from here.
      const reviewErrors = validateStep("review", values);
      if (Object.keys(reviewErrors).length > 0) {
        setErrors(reviewErrors);
        focusFirstInvalid(event.currentTarget);
        return;
      }
      if (canSend) {
        setErrors({});
        setSendError(null);
        setConfirming(true);
      }
      return;
    }

    setFormError(null);
    const stepErrors = validateStep(step, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      focusFirstInvalid(event.currentTarget);
      return;
    }
    setErrors({});

    if (step === "message") {
      // Entering Review creates or updates the draft so the API can compute exact recipients.
      inFlight.current = true;
      setBusy("review");
      try {
        await persistDraft();
        setStepIndex((index) => index + 1);
      } catch (error) {
        reportSaveError(error);
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
      return;
    }

    setStepIndex((index) => index + 1);
  }

  async function handleSaveDraft() {
    if (inFlight.current || sentRef.current || !canSaveDraft(values)) {
      return;
    }
    inFlight.current = true;
    setBusy("draft");
    setFormError(null);
    try {
      await persistDraft();
      toast.success("Draft saved");
      router.push(listHref);
    } catch (error) {
      reportSaveError(error);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  /** The campaign is queued: latch, announce and leave. Never runs twice. */
  function completeSend(id: string) {
    sentRef.current = true;
    setSent(true);
    setConfirming(false);
    setSendError(null);
    toast.success(successMessage(values.timing));
    router.push(`/businesses/${businessId}/campaigns/${id}/analytics`);
  }

  /**
   * A lost response, a server error or a missing campaign does not say whether the queue step
   * ran, so ask the list before telling the user anything.
   */
  async function resolveAmbiguousFailure(id: string, message: string) {
    try {
      const campaigns = await apiFetch<Campaign[]>(`/api/businesses/${businessId}/campaigns`);
      const current = campaigns.find((item) => item.id === id);
      if (current && current.status !== "DRAFT") {
        completeSend(id);
        return;
      }
      setConfirming(false);
      setSendError(
        current ? { message, draftSaved: true } : { message: CAMPAIGN_GONE, draftSaved: false },
      );
    } catch {
      setConfirming(false);
      setSendError({ message: COULD_NOT_CONFIRM, draftSaved: false });
    }
  }

  async function handleSend() {
    if (inFlight.current || sentRef.current || !draftId) {
      return;
    }
    // The chosen time may have passed while the confirm dialog was open.
    const staleErrors = validateStep("review", values);
    if (Object.keys(staleErrors).length > 0) {
      setConfirming(false);
      setErrors(staleErrors);
      focusFirstInvalid(formRef.current);
      return;
    }

    inFlight.current = true;
    setSending(true);
    let stage: "save" | "queue" = "save";
    try {
      const base = `/api/businesses/${businessId}/campaigns/${draftId}`;
      // The queue step reads the stored send time, so save the chosen timing first.
      await apiFetch<Campaign>(base, { method: "PUT", body: campaignPayload(values) });
      stage = "queue";
      await apiFetch(`${base}/queue`, { method: "POST" });
      completeSend(draftId);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not send the campaign. Try again.";
      const ambiguous =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        (stage === "save" && error.status === 404);

      if (ambiguous) {
        await resolveAmbiguousFailure(draftId, message);
      } else {
        if (error instanceof ApiError && error.status === 409) {
          // The refusal is about who can receive it; bring the numbers and blocks up to date.
          preview.refetch();
        }
        setConfirming(false);
        setSendError({ message, draftSaved: true });
      }
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  function handleBack() {
    if (sentRef.current) {
      return;
    }
    setSendError(null);
    setFormError(null);
    setErrors({});
    setStepIndex((index) => Math.max(0, index - 1));
  }

  const optedIn = dashboard.data?.summary.customers.emailOptedIn ?? null;

  return (
    <div>
      <WizardStepper steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <section
          aria-labelledby="wizard-step-heading"
          className="rounded-container border border-line bg-surface p-5 sm:p-6"
        >
          <p className="text-[13px] text-muted">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </p>
          <h2
            id="wizard-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="mb-4 text-base font-semibold text-ink focus:outline-none"
          >
            {WIZARD_STEPS[stepIndex].label}
          </h2>

          {step === "basics" ? (
            <StepBasics
              title={values.title}
              error={errors.title}
              onChange={(value) => setField("title", value)}
            />
          ) : step === "recipients" ? (
            <StepRecipients
              businessId={businessId}
              optedInCount={optedIn}
              loading={dashboard.loading}
              slow={dashboard.slow}
              failed={dashboard.error !== null}
            />
          ) : step === "message" ? (
            <StepMessage
              title={values.title}
              message={values.message}
              error={errors.message}
              businessName={businessName}
              onChange={(value) => setField("message", value)}
            />
          ) : (
            <StepReview
              values={values}
              errors={errors}
              onChange={(key, value) => {
                setSendError(null);
                setField(key, value);
              }}
              preview={preview}
              blocks={blocks}
              sendError={sendError}
              sendErrorRef={sendErrorRef}
              onRecheck={() => {
                setSendError(null);
                preview.refetch();
              }}
            />
          )}
        </section>

        {formError ? <FormError message={formError} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={handleBack} disabled={busy !== null || sent}>
              Back
            </Button>
          ) : (
            <Link href={listHref} className={buttonClasses({ variant: "ghost" })}>
              Cancel
            </Link>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              loading={busy === "draft"}
              disabled={busy === "review" || sent || !canSaveDraft(values)}
            >
              Save draft
            </Button>
            {!isReview ? (
              <Button
                type="submit"
                variant="primary"
                loading={busy === "review"}
                disabled={busy === "draft"}
              >
                {step === "message" ? "Review" : "Continue"}
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                disabled={!canSend || busy !== null || sending || sent}
              >
                {submitLabel(values.timing)}
              </Button>
            )}
          </div>
        </div>

        {!canSaveDraft(values) ? (
          <p className="text-right text-[13px] text-muted">
            Save draft is available once the campaign has a name and a message.
          </p>
        ) : null}
      </form>

      <SendConfirmDialog
        open={confirming}
        sending={sending}
        onConfirm={handleSend}
        onCancel={() => setConfirming(false)}
        {...confirmCopy({
          recipientCount: eligibleCount ?? 0,
          timing: values.timing,
          scheduledLabel: scheduledIso ? formatDateTime(scheduledIso) : "",
        })}
      />
    </div>
  );
}
