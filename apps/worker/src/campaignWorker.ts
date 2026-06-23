import { workerEnv } from "./config/env.js";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "@direconnect/db";
import { sendMessage } from "./services/messageSender.js";
import { buildCampaignEmailHtml } from "./services/emailTemplate.js";

type SendCampaignJobData = {
  campaignId: string;
  businessId: string;
  ownerId: string;
};

const connection = new Redis(workerEnv.redisUrl, {
  maxRetriesPerRequest: null,
});

async function processCampaignJob(data: SendCampaignJobData) {
  const { campaignId, businessId, ownerId } = data;

  console.log("Processing campaign job:", data);

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      businessId,
      ownerId,
      status: "QUEUED",
    },
    include: {
      business: true,
      recipientSnapshots: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!campaign) {
    console.log("Campaign not found or not QUEUED. Skipping.");
    return;
  }

  console.log(`Processing campaign: ${campaign.title}`);

  for (const snapshot of campaign.recipientSnapshots) {
    if (!snapshot.eligible) {
    await prisma.messageLog.create({
      data: {
        ownerId: campaign.ownerId,
        businessId: campaign.businessId,
        campaignId: campaign.id,
        customerId: snapshot.customerId,
        channel: campaign.channel,
        recipient: snapshot.recipient ?? "MISSING",
        status: "FAILED",
        errorMessage: snapshot.reason ?? "Customer was not eligible at queue time",
        sentAt: null,
      },
    });

    continue;
  }

  if (!snapshot.recipient) {
    await prisma.messageLog.create({
      data: {
        ownerId: campaign.ownerId,
        businessId: campaign.businessId,
        campaignId: campaign.id,
        customerId: snapshot.customerId,
        channel: campaign.channel,
        recipient: "MISSING",
        status: "FAILED",
        errorMessage: `Customer had no ${campaign.channel} recipient at queue time`,
        sentAt: null,
      },
    });

    continue;
  }

  const appUrl = workerEnv.appUrl;

  const unsubscribeLink = snapshot.unsubscribeTokenAtQueue
    ? `${appUrl}/api/unsubscribe/${snapshot.unsubscribeTokenAtQueue}`
    : null;

  const messageWithUnsubscribe =
    campaign.channel === "EMAIL" && unsubscribeLink
      ? `${campaign.message}\n\nUnsubscribe: ${unsubscribeLink}`
      : campaign.message;

  const htmlMessage =
  campaign.channel === "EMAIL"
    ? buildCampaignEmailHtml({
        businessName: campaign.business.name,
        campaignTitle: campaign.title,
        message: campaign.message,
        unsubscribeLink,
        website: campaign.business.website,
      })
    : undefined;

  const sendResult = await sendMessage({
    channel: campaign.channel,
    recipient: snapshot.recipient,
    subject: campaign.title,
    message: messageWithUnsubscribe,
    ...(htmlMessage ? { htmlMessage } : {}),
  });

  await prisma.messageLog.create({
    data: {
      ownerId: campaign.ownerId,
      businessId: campaign.businessId,
      campaignId: campaign.id,
      customerId: snapshot.customerId,
      channel: campaign.channel,
      recipient: snapshot.recipient,
      status: sendResult.success ? "SENT" : "FAILED",
      errorMessage: sendResult.errorMessage ?? null,
      sentAt: sendResult.success ? new Date() : null,
    },
  });
  }
}

const worker = new Worker<SendCampaignJobData>(
  "campaign-send",
  async (job) => {
    console.log(`Received job ${job.id}: ${job.name}`);
    await processCampaignJob(job.data);
  },
  {
    connection,
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
});

console.log("Campaign worker is running and waiting for jobs...");
