import { z } from "zod";

const websiteSchema = z
    .string()
    .trim()
    .transform((website) => {
        if (!website || /^[a-z][a-z\d+.-]*:\/\//i.test(website)) {
            return website;
        }

        return `https://${website}`;
    })
    .pipe(
        z.union([
            z.literal(""),
            z.string().url().refine((website) => {
                const protocol = new URL(website).protocol;
                return protocol === "http:" || protocol === "https:";
            }, "Website must use HTTP or HTTPS"),
        ]),
    )
    .optional();

export const createBusinessSchema = z.object({
    name: z.string().min(1, "Business name is required"),
    description: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    website: websiteSchema,
});

export const updateBusinessSchema = createBusinessSchema;

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
