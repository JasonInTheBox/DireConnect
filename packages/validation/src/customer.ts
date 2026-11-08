import { z } from "zod";

export const createCustomerSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    notes: z.string().max(2000, "Keep notes under 2,000 characters").optional(),
    emailOptIn: z.boolean().optional(),
    smsOptIn: z.boolean().optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
