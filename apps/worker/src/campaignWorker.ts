import { fileURLToPath } from "node:url";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "@direconnect/db";
import { workerEnv } from "./config/env.js";
import { sendMessage } from "./services/messageSender.js";
import { buildCampaignEmailHtml } from "./services/emailTemplate.js";
import { initSentry, Sentry } from "./lib/sentry.js";

initSentry();

export type SendCampaignJobData = {
  campaignId: string;
  businessId: string;
  ownerId: string;
};

type CampaignJobDependencies = {
  db?: typeof prisma;
  messageSender?: typeof sendMessage;
  emailHtmlBuilder?: typeof buildCampaignEmailHtml;
  appUrl?: string;
  now?: () => Date;
};

type CampaignJobResult =
  | {
      processed: true;
      sentCount: number;
      failedCount: number;
      skippedCount: number;
    }
  | {
      processed: false;
      reason: string;
    };

export async function processCampaignJob(
  data: SendCampaignJobData,
  dependencies: CampaignJobDependencies = {},
): Promise<CampaignJobResult> {
  const { campaignId, businessId, ownerId } = data;
  const db = dependencies.db ?? prisma;
  const messageSender = dependencies.messageSender ?? sendMessage;
  const emailHtmlBuilder =
    dependencies.emailHtmlBuilder ?? buildCampaignEmailHtml;
  const appUrl = dependencies.appUrl ?? workerEnv.appUrl;
  const now = dependencies.now ?? (() => new Date());

  console.log("Processing campaign job:", data);

  const campaign = await db.campaign.findFirst({
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

    return {
      processed: false,
      reason: "Campaign not found or not QUEUED",
    };
  }

  console.log(`Processing campaign: ${campaign.title}`);

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const snapshot of campaign.recipientSnapshots) {
    if (!snapshot.eligible) {
      skippedCount += 1;

      await db.messageLog.create({
        data: {
          ownerId: campaign.ownerId,
          businessId: campaign.businessId,
          campaignId: campaign.id,
          customerId: snapshot.customerId,
          channel: campaign.channel,
          recipient: snapshot.recipient ?? "MISSING",
          status: "FAILED",
          errorMessage:
            snapshot.reason ?? "Customer was not eligible at queue time",
          sentAt: null,
        },
      });

      continue;
    }

    if (!snapshot.recipient) {
      skippedCount += 1;

      await db.messageLog.create({
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

    const unsubscribeLink = snapshot.unsubscribeTokenAtQueue
      ? `${appUrl}/api/unsubscribe/${snapshot.unsubscribeTokenAtQueue}`
      : null;

    const messageWithUnsubscribe =
      campaign.channel === "EMAIL" && unsubscribeLink
        ? `${campaign.message}\n\nUnsubscribe: ${unsubscribeLink}`
        : campaign.message;

    const htmlMessage =
      campaign.channel === "EMAIL"
        ? emailHtmlBuilder({
            businessName: campaign.business.name,
            campaignTitle: campaign.title,
            message: campaign.message,
            unsubscribeLink,
            website: campaign.business.website,
          })
        : undefined;

    const sendResult = await messageSender({
      channel: campaign.channel,
      recipient: snapshot.recipient,
      subject: campaign.title,
      message: messageWithUnsubscribe,
      ...(htmlMessage ? { htmlMessage } : {}),
    });

    if (sendResult.success) {
      sentCount += 1;
    } else {
      failedCount += 1;
    }

    await db.messageLog.create({
      data: {
        ownerId: campaign.ownerId,
        businessId: campaign.businessId,
        campaignId: campaign.id,
        customerId: snapshot.customerId,
        channel: campaign.channel,
        recipient: snapshot.recipient,
        status: sendResult.success ? "SENT" : "FAILED",
        errorMessage: sendResult.errorMessage ?? null,
        sentAt: sendResult.success ? now() : null,
      },
    });
  }

  await db.campaign.updateMany({
    where: {
      id: campaign.id,
      businessId: campaign.businessId,
      ownerId: campaign.ownerId,
      status: "QUEUED",
    },
    data: {
      status: failedCount > 0 ? "FAILED" : "SENT",
    },
  });

  return {
    processed: true,
    sentCount,
    failedCount,
    skippedCount,
  };
}

export function startCampaignWorker() {
  const connection = new Redis(workerEnv.redisUrl, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker<SendCampaignJobData>(
    "campaign-send",
    async (job) => {
      console.log(`Received job ${job.id}: ${job.name}`);
      try {
        await processCampaignJob(job.data);
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    },
    {
      connection,
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    console.log(`Job completed: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job failed: ${job?.id}`, error);

    Sentry.captureException(error, {
      tags: {
        worker: "campaign-send",
        jobName: job?.name ?? "unknown",
      },
      extra: {
        jobId: job?.id,
        jobData: job?.data,
      },
    });
  });

  console.log("Campaign worker is running and waiting for jobs...");

  return worker;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startCampaignWorker();
}
