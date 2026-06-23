import { z } from "zod";

export const createBusinessSchema = z.object({
    name: z.string().min(1, "Business name is required"),
    description: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal("")),
});

export const updateBusinessSchema = createBusinessSchema;

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
