import { Queue } from "bullmq";
import { Redis } from "ioredis";

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export type SendCampaignJobData = {
    campaignId: string;
    businessId: string;
    ownerId: string;
};

export const campaignQueue = new Queue<SendCampaignJobData>("campaign-send", {
    connection,
});
