import { Queue } from "bullmq";
import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
    throw new Error("Missing required environment variable: REDIS_URL");
}

const connection = new Redis(redisUrl, {
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
