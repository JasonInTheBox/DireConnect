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

function isSkippedBeforeSendReason(reason: string | null | undefined) {
  return Boolean(
    reason &&
      (reason.startsWith("Customer does not match campaign audience") ||
        reason === "Customer has unsubscribed" ||
        reason.startsWith("Customer has not opted in to") ||
        reason.startsWith("Customer has no ") ||
        reason.startsWith("Customer record is unavailable")),
  );
}

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

  const activeCampaign = campaign;

  if (campaign.channel === "SMS") {
    const errorMessage = "SMS campaigns are temporarily disabled.";
    let failedCount = 0;
    let skippedCount = 0;

    for (const snapshot of campaign.recipientSnapshots) {
      if (snapshot.eligible) failedCount += 1;
      else skippedCount += 1;

      await db.messageLog.create({
        data: {
          ownerId: campaign.ownerId,
          businessId: campaign.businessId,
          campaignId: campaign.id,
          customerId: snapshot.customerId,
          channel: campaign.channel,
          recipient: snapshot.recipient ?? "MISSING",
          status: "FAILED",
          errorMessage: snapshot.eligible
            ? errorMessage
            : snapshot.reason ?? errorMessage,
          sentAt: null,
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
      data: { status: "FAILED" },
    });

    return { processed: true, sentCount: 0, failedCount, skippedCount };
  }

  const [existingLogs, customers] = await Promise.all([
    db.messageLog.findMany({
      where: {
        campaignId: campaign.id,
        businessId: campaign.businessId,
        ownerId: campaign.ownerId,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.customer.findMany({
      where: {
        id: { in: campaign.recipientSnapshots.map((snapshot) => snapshot.customerId) },
        businessId: campaign.businessId,
        ownerId: campaign.ownerId,
      },
    }),
  ]);

  const latestLogByCustomer = new Map<string, (typeof existingLogs)[number]>();
  for (const log of existingLogs) {
    if (!latestLogByCustomer.has(log.customerId)) {
      latestLogByCustomer.set(log.customerId, log);
    }
  }

  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  async function saveMessageLog(
    customerId: string,
    data: {
      recipient: string;
      status: "PENDING" | "SENT" | "FAILED";
      errorMessage: string | null;
      sentAt: Date | null;
    },
  ) {
    const existing = latestLogByCustomer.get(customerId);
    if (existing) {
      await db.messageLog.update({ where: { id: existing.id }, data });
      latestLogByCustomer.set(customerId, { ...existing, ...data });
      return;
    }

    const created = await db.messageLog.create({
      data: {
        ownerId: activeCampaign.ownerId,
        businessId: activeCampaign.businessId,
        campaignId: activeCampaign.id,
        customerId,
        channel: activeCampaign.channel,
        ...data,
      },
    });
    if (created) latestLogByCustomer.set(customerId, created);
  }

  for (const snapshot of campaign.recipientSnapshots) {
    const priorLog = latestLogByCustomer.get(snapshot.customerId);
    if (priorLog?.status === "SENT") {
      sentCount += 1;
      continue;
    }
    if (priorLog?.status === "FAILED") {
      if (isSkippedBeforeSendReason(priorLog.errorMessage)) skippedCount += 1;
      else failedCount += 1;
      continue;
    }

    if (!snapshot.eligible) {
      skippedCount += 1;
      await saveMessageLog(snapshot.customerId, {
        recipient: snapshot.recipient ?? "MISSING",
        status: "FAILED",
        errorMessage: snapshot.reason ?? "Customer was not eligible at queue time",
        sentAt: null,
      });
      continue;
    }

    const currentCustomer = customerById.get(snapshot.customerId);
    if (!currentCustomer || !currentCustomer.email) {
      skippedCount += 1;
      await saveMessageLog(snapshot.customerId, {
        recipient: currentCustomer?.email ?? snapshot.recipient ?? "MISSING",
        status: "FAILED",
        errorMessage: currentCustomer
          ? "Customer has no EMAIL recipient"
          : "Customer record is unavailable; refusing to send",
        sentAt: null,
      });
      continue;
    }

    if (!currentCustomer.emailOptIn || currentCustomer.unsubscribedAt) {
      skippedCount += 1;
      await saveMessageLog(snapshot.customerId, {
        recipient: currentCustomer.email,
        status: "FAILED",
        errorMessage: currentCustomer.unsubscribedAt
          ? "Customer has unsubscribed"
          : "Customer has not opted in to EMAIL",
        sentAt: null,
      });
      continue;
    }

    const unsubscribeToken = currentCustomer.unsubscribeToken ?? snapshot.unsubscribeTokenAtQueue;
    const unsubscribeLink = unsubscribeToken
      ? `${appUrl}/api/unsubscribe/${unsubscribeToken}`
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
      channel: "EMAIL",
      recipient: currentCustomer.email,
      subject: campaign.title,
      message: messageWithUnsubscribe,
      idempotencyKey: `campaign-${campaign.id}-customer-${snapshot.customerId}-recipient-${currentCustomer.email}`,
      ...(htmlMessage ? { htmlMessage } : {}),
    });

    if (!sendResult.success && sendResult.retryable) {
      await saveMessageLog(snapshot.customerId, {
        recipient: currentCustomer.email,
        status: "PENDING",
        errorMessage: sendResult.errorMessage ?? "Temporary email provider error",
        sentAt: null,
      });

      const error = new Error(sendResult.errorMessage ?? "Temporary email provider error") as Error & {
        retryAfterMs?: number;
      };
      if (sendResult.retryAfterMs !== undefined) error.retryAfterMs = sendResult.retryAfterMs;
      throw error;
    }

    if (sendResult.success) sentCount += 1;
    else failedCount += 1;

    await saveMessageLog(snapshot.customerId, {
      recipient: currentCustomer.email,
      status: sendResult.success ? "SENT" : "FAILED",
      errorMessage: sendResult.errorMessage ?? null,
      sentAt: sendResult.success ? now() : null,
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
      settings: {
        backoffStrategy: (attemptsMade, _type, error) => {
          const retryAfterMs = (error as Error & { retryAfterMs?: number })
            .retryAfterMs;
          const exponentialDelay = 5000 * 2 ** Math.max(attemptsMade - 1, 0);
          return Math.max(exponentialDelay, retryAfterMs ?? 0);
        },
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`Job completed: ${job.id}`);
  });

  worker.on("failed", async (job, error) => {
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

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        await prisma.messageLog.updateMany({
          where: {
            campaignId: job.data.campaignId,
            businessId: job.data.businessId,
            ownerId: job.data.ownerId,
            status: "PENDING",
          },
          data: {
            status: "FAILED",
            errorMessage: error.message,
          },
        });
        await prisma.campaign.updateMany({
          where: {
            id: job.data.campaignId,
            businessId: job.data.businessId,
            ownerId: job.data.ownerId,
            status: "QUEUED",
          },
          data: { status: "FAILED" },
        });
      } catch (updateError) {
        Sentry.captureException(updateError);
      }
    }
  });

  process.once("SIGTERM", () => {
    void worker.close().finally(() => connection.quit());
  });

  process.once("SIGINT", () => {
    void worker.close().finally(() => connection.quit());
  });

  console.log("Campaign worker is running and waiting for jobs...");

  return worker;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startCampaignWorker();
}
