"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { StepBasics } from "./step-basics";
import { StepMessage } from "./step-message";
import { StepRecipients } from "./step-recipients";
import { StepReview } from "./step-review";
import { WizardStepper } from "./stepper";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import {
  campaignPayload,
  canSaveDraft,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardStepId,
  type WizardValues,
} from "@/lib/campaignWizard";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Campaign, CampaignPreviewResponse, DashboardResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

/** Server field errors belong to the step that shows the field. */
const FIELD_STEP: Record<string, WizardStepId> = { title: "basics", message: "message" };

export function CampaignWizard({
  businessId,
  businessName,
  campaign,
}: {
  businessId: string;
  businessName: string;
  /** The draft being edited, or null to create a new campaign. */
  campaign: Campaign | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const listHref = `/businesses/${businessId}/campaigns`;

  const [values, setValues] = useState<WizardValues>(() => wizardValues(campaign));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(campaign?.id ?? null);
  const [busy, setBusy] = useState<"draft" | "review" | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(stepIndex);

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
    headingRef.current?.focus();
  }, [stepIndex]);

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
      focusFirstInvalid(formRef.current);
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
    if (inFlight.current || isReview) {
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
    if (inFlight.current || !canSaveDraft(values)) {
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

  function handleBack() {
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
            <StepReview values={values} preview={preview} />
          )}
        </section>

        {formError ? <FormError message={formError} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={handleBack} disabled={busy !== null}>
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
              disabled={busy === "review" || !canSaveDraft(values)}
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
            ) : null}
          </div>
        </div>

        {!canSaveDraft(values) ? (
          <p className="text-right text-[13px] text-muted">
            Save draft is available once the campaign has a name and a message.
          </p>
        ) : null}
      </form>
    </div>
  );
}
