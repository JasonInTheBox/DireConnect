import type { Customer } from "./types";

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emailOptIn: boolean;
};

export function customerFormValues(customer?: Customer | null): CustomerFormValues {
  return {
    firstName: customer?.firstName ?? "",
    lastName: customer?.lastName ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    emailOptIn: customer?.emailOptIn ?? false,
  };
}

export function validateCustomerForm(values: CustomerFormValues): Record<string, string> {
  return values.firstName.trim() ? {} : { firstName: "Enter a first name." };
}

/**
 * The API replaces every field on PUT, so SMS consent (which this form does not show while
 * SMS is paused) is passed through from the existing customer instead of being reset.
 */
export function customerPayload(
  values: CustomerFormValues,
  existing?: Pick<Customer, "smsOptIn"> | null,
) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    emailOptIn: values.emailOptIn,
    smsOptIn: existing?.smsOptIn ?? false,
  };
}

/** Ticking consent on someone who is not currently opted in re-subscribes them. */
export function needsReconsentWarning(customer?: Customer | null): boolean {
  return Boolean(customer && !(customer.emailOptIn && !customer.unsubscribedAt));
}
