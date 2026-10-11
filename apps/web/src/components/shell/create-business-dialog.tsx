"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import { focusFirstInvalid } from "@/lib/forms";
import type { Business } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useBusinesses } from "./businesses-provider";

type FormValues = {
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
};

const EMPTY: FormValues = { name: "", description: "", email: "", phone: "", website: "" };

export function CreateBusinessDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a business"
      description="Each business has its own customers and campaigns."
    >
      <CreateBusinessForm onDone={onClose} />
    </Dialog>
  );
}

function CreateBusinessForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { addBusiness } = useBusinesses();
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof FormValues) {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = values.name.trim();

    setFormError(null);
    if (!name) {
      setErrors({ name: "Enter a business name." });
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const business = await apiFetch<Business>("/api/businesses", {
        method: "POST",
        body: { ...values, name },
      });
      addBusiness(business);
      toast.success("Business created");
      onDone();
      router.push(`/businesses/${business.id}/dashboard`);
    } catch (error) {
      const fieldErrors = fieldErrorsFromApiError(error);
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        focusFirstInvalid(form);
      } else {
        setFormError(
          error instanceof ApiError ? error.message : "Could not create the business. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
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
          Create business
        </Button>
      </div>
    </form>
  );
}
