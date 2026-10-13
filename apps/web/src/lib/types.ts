export type Business = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type Customer = {
  id: string;
  ownerId: string;
  businessId: string;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  unsubscribedAt?: string | null;
  createdAt?: string;
};
