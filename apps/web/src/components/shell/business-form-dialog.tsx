"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import { businessFormValues, businessPayload, type BusinessFormValues } from "@/lib/businessForm";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Business } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useBusinesses } from "./businesses-provider";

const FIELDS = ["name", "description", "email", "phone", "website"] as const;

type BusinessFormDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Edit this business. Omit (or pass null) to create a new one. */
  business?: Business | null;
};

export function BusinessFormDialog({ open, onClose, business = null }: BusinessFormDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={business ? "Edit business" : "Create a business"}
      description={business ? undefined : "Each business has its own customers and campaigns."}
      dismissible={!busy}
    >
      <BusinessForm business={business} onDone={onClose} onBusyChange={setBusy} />
    </Dialog>
  );
}

function BusinessForm({
  business,
  onDone,
  onBusyChange,
}: {
  business: Business | null;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { addBusiness, refetch } = useBusinesses();
  const [values, setValues] = useState<BusinessFormValues>(() => businessFormValues(business));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof BusinessFormValues) {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setFormError(null);
    if (!values.name.trim()) {
      setErrors({ name: "Enter a business name." });
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    onBusyChange(true);
    try {
      const payload = businessPayload(values);
      if (business) {
        await apiFetch<Business>(`/api/businesses/${business.id}`, {
          method: "PUT",
          body: payload,
        });
        refetch();
        toast.success("Business updated");
        onDone();
      } else {
        const created = await apiFetch<Business>("/api/businesses", {
          method: "POST",
          body: payload,
        });
        addBusiness(created);
        toast.success("Business created");
        onDone();
        router.push(`/businesses/${created.id}/dashboard`);
      }
    } catch (error) {
      const { fields, unmapped } = splitFieldErrors(fieldErrorsFromApiError(error), FIELDS);
      const hasFieldErrors = Object.keys(fields).length > 0;

      if (hasFieldErrors) {
        setErrors(fields);
        focusFirstInvalid(form);
      }
      if (unmapped.length > 0) {
        setFormError(unmapped.join(" "));
      } else if (!hasFieldErrors) {
        setFormError(
          error instanceof ApiError ? error.message : "Could not save the business. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        label="Business name"
        required
        // React autoFocus fires while the native dialog is still closed; Dialog focuses [data-autofocus] after showModal().
        data-autofocus="true"
        autoComplete="organization"
        value={values.name}
        onChange={update("name")}
        error={errors.name}
      />
      <TextAreaField
        label="Description"
        hint="Optional. A line about what the business does."
        value={values.description}
        onChange={update("description")}
        error={errors.description}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          error={errors.email}
        />
        <TextField
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={update("phone")}
          error={errors.phone}
        />
      </div>
      <TextField
        label="Website"
        placeholder="example.com"
        autoComplete="url"
        value={values.website}
        onChange={update("website")}
        error={errors.website}
      />

      {formError ? <FormError message={formError} /> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {business ? "Save changes" : "Create business"}
        </Button>
      </div>
    </form>
  );
}
