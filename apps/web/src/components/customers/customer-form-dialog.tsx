"use client";

import { useState, type FormEvent } from "react";
import { ApiError, apiFetch, fieldErrorsFromApiError } from "@/lib/apiClient";
import {
  customerFormValues,
  customerPayload,
  needsReconsentWarning,
  validateCustomerForm,
  type CustomerFormValues,
} from "@/lib/customerForm";
import { focusFirstInvalid, splitFieldErrors } from "@/lib/forms";
import type { Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";

const FIELDS = ["firstName", "lastName", "email", "phone"] as const;

type CustomerFormDialogProps = {
  open: boolean;
  onClose: () => void;
  businessId: string;
  /** Edit this customer. Omit (or pass null) to add a new one. */
  customer?: Customer | null;
  onSaved: () => void;
};

export function CustomerFormDialog({
  open,
  onClose,
  businessId,
  customer = null,
  onSaved,
}: CustomerFormDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      description={customer ? undefined : "Add someone you want to keep in touch with."}
      dismissible={!busy}
    >
      <CustomerForm
        businessId={businessId}
        customer={customer}
        onSaved={onSaved}
        onDone={onClose}
        onBusyChange={setBusy}
      />
    </Dialog>
  );
}

function CustomerForm({
  businessId,
  customer,
  onSaved,
  onDone,
  onBusyChange,
}: {
  businessId: string;
  customer: Customer | null;
  onSaved: () => void;
  onDone: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<CustomerFormValues>(() => customerFormValues(customer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: "firstName" | "lastName" | "email" | "phone") {
    return (event: { target: { value: string } }) =>
      setValues((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    setFormError(null);
    const clientErrors = validateCustomerForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstInvalid(form);
      return;
    }

    setErrors({});
    setSubmitting(true);
    onBusyChange(true);
    try {
      const base = `/api/businesses/${businessId}/customers`;
      await apiFetch<Customer>(customer ? `${base}/${customer.id}` : base, {
        method: customer ? "PUT" : "POST",
        body: customerPayload(values, customer),
      });
      onSaved();
      toast.success(customer ? "Customer updated" : "Customer added");
      onDone();
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
          error instanceof ApiError ? error.message : "Could not save the customer. Try again.",
        );
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          required
          // React autoFocus fires while the native dialog is still closed; Dialog focuses [data-autofocus] after showModal().
          data-autofocus="true"
          autoComplete="off"
          value={values.firstName}
          onChange={update("firstName")}
          error={errors.firstName}
        />
        <TextField
          label="Last name"
          autoComplete="off"
          value={values.lastName}
          onChange={update("lastName")}
          error={errors.lastName}
        />
      </div>
      <TextField
        label="Email"
        type="email"
        autoComplete="off"
        value={values.email}
        onChange={update("email")}
        error={errors.email}
      />
      <TextField
        label="Phone"
        type="tel"
        autoComplete="off"
        value={values.phone}
        onChange={update("phone")}
        error={errors.phone}
      />
      <CheckboxField
        label="Customer explicitly agreed to receive promotional emails"
        hint={
          needsReconsentWarning(customer)
            ? "This customer isn’t opted in to email right now (they may have unsubscribed). Only turn this on if they’ve told you they want to hear from you."
            : "Only customers who agreed can receive your email campaigns."
        }
        checked={values.emailOptIn}
        onChange={(event) =>
          setValues((previous) => ({ ...previous, emailOptIn: event.target.checked }))
        }
      />

      {formError ? <FormError message={formError} /> : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={submitting}>
          {customer ? "Save changes" : "Add customer"}
        </Button>
      </div>
    </form>
  );
}
