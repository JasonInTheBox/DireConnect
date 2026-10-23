import type { Business } from "./types";

export type BusinessFormValues = {
  name: string;
  description: string;
  email: string;
  phone: string;
  website: string;
};

export function businessFormValues(business?: Business | null): BusinessFormValues {
  return {
    name: business?.name ?? "",
    description: business?.description ?? "",
    email: business?.email ?? "",
    phone: business?.phone ?? "",
    website: business?.website ?? "",
  };
}

export function businessPayload(values: BusinessFormValues): BusinessFormValues {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    website: values.website.trim(),
  };
}
