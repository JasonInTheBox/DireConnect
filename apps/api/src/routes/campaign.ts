import { Router } from "express";
import { campaignQueue } from "../lib/campaignQueue.js";
import { prisma } from "@direconnect/db";
import { createCampaignSchema, updateCampaignSchema } from "@direconnect/validation";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getCampaignEligibility } from "../lib/campaignEligibility.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";
import { error } from "console";

export const campaignRouter = Router({ mergeParams: true });

function getParam(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function verifyBusinessOwnership(businessId: string, ownerId: string) {
  return prisma.business.findUnique({
    where: {
      id_ownerId: {
        id: businessId,
        ownerId,
      },
    },
  });
}

function isSkippedBeforeSendReason(errorMessage: string | null): boolean {
  if (!errorMessage) {
    return false;
  }

  return (
    errorMessage.startsWith("Customer does not match campaign audience") ||
    errorMessage === "Customer has unsubscribed" ||
    errorMessage.startsWith("Customer has not opted in to") ||
    errorMessage.startsWith("Customer has no ")
  );
}

function countByReason<T>(
  items: T[],
  getReason: (item: T) => string | null,
  fallbackReason: string
): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const reason = getReason(item) ?? fallbackReason;
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
}

campaignRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const businessId = getParam(req.params.businessId);

  if (!businessId) {
    return res.status(400).json({ error: "Invalid business ID" });
  }

  const business = await verifyBusinessOwnership(businessId, req.user!.id);

  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }

  const campaigns = await prisma.campaign.findMany({
    where: {
      businessId,
      ownerId: req.user!.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(campaigns);
});

campaignRouter.get("/:campaignId/logs", requireAuth, async (req: AuthenticatedRequest, res) => {
  const businessId = getParam(req.params.businessId);
  const campaignId = getParam(req.params.campaignId);

  if (!businessId) {
    return res.status(400).json({ error: "Invalid business ID" });
  }

  if (!campaignId) {
    return res.status(400).json({ error: "Invalid campaign ID" });
  }

  const business = await verifyBusinessOwnership(businessId, req.user!.id);

  if (!business) {
    return res.status(404).json({ error: "Business not found" });
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      businessId,
      ownerId: req.user!.id,
    },
  });

  if (!campaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const logs = await prisma.messageLog.findMany({
    where: {
      campaignId,
      businessId,
      ownerId: req.user!.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  res.json(logs);
});

campaignRouter.get(
  "/:campaignId/preview",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);
    const campaignId = getParam(req.params.campaignId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const snapshots = await prisma.campaignRecipientSnapshot.findMany({
      where: {
        campaignId,
        businessId,
        ownerId: req.user!.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let results;

    if (snapshots.length > 0) {
      results = snapshots.map((snapshot) => ({
        customerId: snapshot.customerId,
        recipient: snapshot.recipient,
        eligible: snapshot.eligible,
        reason: snapshot.reason,
      }));
    } else {
      const customers = await prisma.customer.findMany({
        where: {
          businessId,
          ownerId: req.user!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      results = customers.map((customer) =>
        getCampaignEligibility(campaign, customer)
      );
    }

    const eligible = results.filter((result) => result.eligible);
    const skipped = results.filter((result) => !result.eligible);

    const skippedByReason = skipped.reduce<Record<string, number>>(
      (acc, result) => {
        const reason = result.reason ?? "Unknown reason";
        acc[reason] = (acc[reason] ?? 0) + 1;
        return acc;
      },
      {}
    );

    res.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        channel: campaign.channel,
        targetAudience: campaign.targetAudience,
        status: campaign.status,
      },
      summary: {
        totalCustomers: results.length,
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        skippedByReason,
        isSnapshot: snapshots.length > 0,
      },
      eligible,
      skipped,
    });
  });

campaignRouter.get(
  "/:campaignId/analytics",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);
    const campaignId = getParam(req.params.campaignId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const snapshots = await prisma.campaignRecipientSnapshot.findMany({
      where: {
        campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    const logs = await prisma.messageLog.findMany({
      where: {
        campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    const hasSnapshot = snapshots.length > 0;

    const sentLogs = logs.filter((log) => log.status === "SENT");
    const pendingLogs = logs.filter((log) => log.status === "PENDING");

    let totalRecipientCount = 0;
    let eligibleCount = 0;
    let skippedBeforeSendCount = 0;
    let attemptedSendCount = 0;
    let failedDeliveryCount = 0;
    let skippedByReason: Record<string, number> = {};
    let failedByReason: Record<string, number> = {};

    if (hasSnapshot) {
      const eligibleSnapshots = snapshots.filter((snapshot) => snapshot.eligible);
      const skippedSnapshots = snapshots.filter((snapshot) => !snapshot.eligible);

      const eligibleCustomerIds = new Set(
        eligibleSnapshots.map((snapshot) => snapshot.customerId)
      );

      const deliveryFailedLogs = logs.filter((log) => {
        if (log.status !== "FAILED") {
          return false;
        }

        return log.customerId !== null && eligibleCustomerIds.has(log.customerId);
      });

      totalRecipientCount = snapshots.length;
      eligibleCount = eligibleSnapshots.length;
      skippedBeforeSendCount = skippedSnapshots.length;
      failedDeliveryCount = deliveryFailedLogs.length;
      attemptedSendCount = sentLogs.length + failedDeliveryCount + pendingLogs.length;

      skippedByReason = countByReason(
        skippedSnapshots,
        (snapshot) => snapshot.reason,
        "Unknown skipped reason"
      );

      failedByReason = countByReason(
        deliveryFailedLogs,
        (log) => log.errorMessage,
        "Unknown send failure"
      );
    } else {
      const skippedLogs = logs.filter(
        (log) =>
          log.status === "FAILED" && isSkippedBeforeSendReason(log.errorMessage)
      );

      const deliveryFailedLogs = logs.filter(
        (log) =>
          log.status === "FAILED" && !isSkippedBeforeSendReason(log.errorMessage)
      );

      totalRecipientCount = logs.length;
      skippedBeforeSendCount = skippedLogs.length;
      failedDeliveryCount = deliveryFailedLogs.length;
      attemptedSendCount = sentLogs.length + failedDeliveryCount + pendingLogs.length;
      eligibleCount = attemptedSendCount;

      skippedByReason = countByReason(
        skippedLogs,
        (log) => log.errorMessage,
        "Unknown skipped reason"
      );

      failedByReason = countByReason(
        deliveryFailedLogs,
        (log) => log.errorMessage,
        "Unknown send failure"
      );
    }

    const sentCount = sentLogs.length;
    const pendingCount = pendingLogs.length;

    const sentRate =
      attemptedSendCount > 0
        ? Math.round((sentCount / attemptedSendCount) * 100)
        : null;

    res.json({
      campaign: {
        id: campaign.id,
        title: campaign.title,
        channel: campaign.channel,
        targetAudience: campaign.targetAudience,
        status: campaign.status,
      },
      summary: {
        analyticsSource: hasSnapshot ? "SNAPSHOT" : "LEGACY_LOGS",

        hasSnapshot,
        totalSnapshotCount: snapshots.length,
        totalRecipientCount,
        eligibleCount,
        skippedBeforeSendCount,

        attemptedSendCount,
        sentCount,
        failedDeliveryCount,
        pendingCount,
        totalLogCount: logs.length,
        sentRate,

        skippedByReason,
        failedByReason,
      },
    });
  }
);

campaignRouter.post("/", requireAuth, validate(createCampaignSchema), async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    const { title, message, channel, sendAt, targetAudience } = req.body;

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const campaign = await prisma.campaign.create({
      data: {
        ownerId: req.user!.id,
        businessId,
        title,
        message,
        channel,
        sendAt: sendAt ? new Date(sendAt) : null,
        targetAudience: targetAudience ?? "ALL",
      },
    });

    res.status(201).json(campaign);
  }
);

campaignRouter.put("/:campaignId", requireAuth, validate(createCampaignSchema), async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);
    const campaignId = getParam(req.params.campaignId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const { title, message, channel, sendAt, targetAudience } = req.body;

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const result = await prisma.campaign.updateMany({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
        status: "DRAFT",
      },
      data: {
        title,
        message,
        channel,
        sendAt: sendAt ? new Date(sendAt) : null,
        targetAudience: targetAudience ?? "ALL",
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Campaign not found. Queued or sent campaigns cannot be edited." });
    }

    const updatedCampaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    res.json(updatedCampaign);
  }
);

campaignRouter.post(
  "/:campaignId/queue",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);
    const campaignId = getParam(req.params.campaignId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const result = await prisma.campaign.updateMany({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
        status: "DRAFT",
      },
      data: {
        status: "QUEUED",
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        error: "Draft campaign not found or campaign is already queued/sent",
      });
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ownerId: req.user!.id,
      },
    });

    const snapshots = customers.map((customer) => {
      const eligibility = getCampaignEligibility(campaign, customer);

      return {
        ownerId: req.user!.id,
        businessId,
        campaignId,
        customerId: customer.id,
        channel: campaign.channel,
        targetAudience: campaign.targetAudience,

        recipient: eligibility.recipient,
        eligible: eligibility.eligible,
        reason: eligibility.reason,

        emailOptInAtQueue: customer.emailOptIn,
        smsOptInAtQueue: customer.smsOptIn,
        unsubscribedAtAtQueue: customer.unsubscribedAt,
        unsubscribeTokenAtQueue: customer.unsubscribeToken,
      };
    });

    await prisma.campaignRecipientSnapshot.deleteMany({
      where: {
        campaignId,
        businessId,
        ownerId: req.user!.id,
      },
    });

    await prisma.campaignRecipientSnapshot.createMany({
      data: snapshots,
    });

    const delay = campaign.sendAt
      ? Math.max(campaign.sendAt.getTime() - Date.now(), 0)
      : 0;

    await campaignQueue.add(
      "send-campaign",
      {
        campaignId,
        businessId,
        ownerId: req.user!.id,
      },
      {
        delay,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    res.json({
      message:
        delay > 0
          ? "Campaign scheduled successfully"
          : "Campaign queued successfully",
      campaignId,
      delay,
      scheduledFor: campaign.sendAt,
    });
  }
);

campaignRouter.delete(
"/:campaignId",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    const businessId = getParam(req.params.businessId);
    const campaignId = getParam(req.params.campaignId);

    if (!businessId) {
      return res.status(400).json({ error: "Invalid business ID" });
    }

    if (!campaignId) {
      return res.status(400).json({ error: "Invalid campaign ID" });
    }

    const business = await verifyBusinessOwnership(businessId, req.user!.id);

    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const result = await prisma.campaign.deleteMany({
      where: {
        id: campaignId,
        businessId,
        ownerId: req.user!.id,
        status: "DRAFT",
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Campaign not found. Queued or sent campaigns cannot be deleted." });
    }

    res.status(204).send();
  }
);
