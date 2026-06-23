import { z } from "zod";

export const createCampaignSchema = z.object({
    title: z.string().min(1, "Campaign title is required"),
    message: z.string().min(1, "Message is required"),
    channel: z.enum(["EMAIL", "SMS"]),
    sendAt: z.string().optional().or(z.literal("")),
    targetAudience: z.enum(["ALL", "EMAIL_OPTED_IN", "SMS_OPTED_IN"]).optional(),
});

export const updateCampaignSchema = createCampaignSchema;

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
