import { describe, expect, it } from "vitest";
import {
  customerFormValues,
  customerPayload,
  needsReconsentWarning,
  validateCustomerForm,
} from "./customerForm";
import type { Customer } from "./types";

const existing: Customer = {
  id: "c1",
  ownerId: "u1",
  businessId: "b1",
  firstName: "Grace",
  lastName: "Hopper",
  email: "grace@navy.test",
  phone: null,
  emailOptIn: false,
  smsOptIn: true,
  unsubscribedAt: "2026-09-01T00:00:00Z",
};

describe("customerFormValues", () => {
  it("starts empty and opted out for a new customer", () => {
    expect(customerFormValues()).toEqual({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      emailOptIn: false,
    });
  });

  it("prefills from an existing customer, turning nulls into empty strings", () => {
    expect(customerFormValues(existing)).toEqual({
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@navy.test",
      phone: "",
      emailOptIn: false,
    });
  });
});

describe("customerFormValues consent", () => {
  it("does not pre-tick consent for someone who unsubscribed", () => {
    const unsubscribed = { ...existing, emailOptIn: true, unsubscribedAt: "2026-09-01T00:00:00Z" };
    expect(customerFormValues(unsubscribed).emailOptIn).toBe(false);
    expect(needsReconsentWarning(unsubscribed)).toBe(true);
  });

  it("pre-ticks consent for a currently opted-in customer", () => {
    const optedIn = { ...existing, emailOptIn: true, unsubscribedAt: null };
    expect(customerFormValues(optedIn).emailOptIn).toBe(true);
  });
});

describe("validateCustomerForm", () => {
  const valid = customerFormValues(existing);

  it("requires a first name", () => {
    expect(validateCustomerForm({ ...valid, firstName: "" })).toEqual({
      firstName: "Enter a first name.",
    });
    expect(validateCustomerForm({ ...valid, firstName: "   " })).toEqual({
      firstName: "Enter a first name.",
    });
  });

  it("accepts a valid form", () => {
    expect(validateCustomerForm(valid)).toEqual({});
  });
});

describe("customerPayload", () => {
  const values = {
    firstName: "  Katherine ",
    lastName: " Johnson ",
    email: " kj@nasa.test ",
    phone: " 555-0100 ",
    emailOptIn: true,
  };

  it("trims every text field", () => {
    expect(customerPayload(values)).toEqual({
      firstName: "Katherine",
      lastName: "Johnson",
      email: "kj@nasa.test",
      phone: "555-0100",
      emailOptIn: true,
      smsOptIn: false,
    });
  });

  it("sends smsOptIn false for a new customer", () => {
    expect(customerPayload(values, null).smsOptIn).toBe(false);
  });

  it("preserves the existing SMS opt-in on edit instead of wiping it", () => {
    expect(customerPayload(values, existing).smsOptIn).toBe(true);
  });
});

describe("needsReconsentWarning", () => {
  it("warns for a customer who is not currently opted in", () => {
    expect(needsReconsentWarning(existing)).toBe(true);
  });

  it("does not warn for a new customer or an opted-in one", () => {
    expect(needsReconsentWarning(null)).toBe(false);
    expect(needsReconsentWarning(undefined)).toBe(false);
    expect(
      needsReconsentWarning({ ...existing, emailOptIn: true, unsubscribedAt: null }),
    ).toBe(false);
  });
});
