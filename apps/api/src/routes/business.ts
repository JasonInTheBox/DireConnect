import { Router } from "express";
import { prisma } from "@direconnect/db";
import {
  createBusinessSchema,
  updateBusinessSchema,
} from "@direconnect/validation";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

function getParam(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function createBusinessRouter(db: typeof prisma = prisma) {
  const businessRouter = Router();

  businessRouter.get(
    "/",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const businesses = await db.business.findMany({
        where: {
          ownerId: req.user!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(businesses);
    },
  );

  businessRouter.post(
    "/",
    requireAuth,
    validate(createBusinessSchema),
    async (req: AuthenticatedRequest, res) => {
      const { name, description, email, phone, website } = req.body;

      const business = await db.business.create({
        data: {
          ownerId: req.user!.id,
          name,
          description: description || null,
          email: email || null,
          phone: phone || null,
          website: website || null,
        },
      });

      res.status(201).json(business);
    },
  );

  businessRouter.get(
    "/:businessId/dashboard",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid businesss ID" });
      }

      const business = await db.business.findUnique({
        where: {
          id_ownerId: {
            id: businessId,
            ownerId: req.user!.id,
          },
        },
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const [
        totalCustomers,
        emailOptedInCustomers,
        smsOptedInCustomers,
        unsubscribedCustomers,

        totalCampaigns,
        draftCampaigns,
        queuedCampaigns,
        sentCampaigns,
        failedCampaigns,

        totalMessageLogs,
        sentMessages,
        failedMessages,
        pendingMessages,

        recentCampaigns,
      ] = await Promise.all([
        db.customer.count({
          where: {
            businessId,
            ownerId: req.user!.id,
          },
        }),

        db.customer.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            emailOptIn: true,
            unsubscribedAt: null,
          },
        }),

        db.customer.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            smsOptIn: true,
            unsubscribedAt: null,
          },
        }),

        db.customer.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            unsubscribedAt: {
              not: null,
            },
          },
        }),

        db.campaign.count({
          where: {
            businessId,
            ownerId: req.user!.id,
          },
        }),

        db.campaign.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "DRAFT",
          },
        }),

        db.campaign.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "QUEUED",
          },
        }),

        db.campaign.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "SENT",
          },
        }),

        db.campaign.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "FAILED",
          },
        }),

        db.messageLog.count({
          where: {
            businessId,
            ownerId: req.user!.id,
          },
        }),

        db.messageLog.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "SENT",
          },
        }),

        db.messageLog.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "FAILED",
          },
        }),

        db.messageLog.count({
          where: {
            businessId,
            ownerId: req.user!.id,
            status: "PENDING",
          },
        }),

        db.campaign.findMany({
          where: {
            businessId,
            ownerId: req.user!.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            title: true,
            channel: true,
            targetAudience: true,
            status: true,
            createdAt: true,
          },
        }),
      ]);

      const messageSuccessRate =
        sentMessages + failedMessages > 0
          ? Math.round((sentMessages / (sentMessages + failedMessages)) * 100)
          : null;

      res.json({
        business: {
          id: business.id,
          name: business.name,
          description: business.description,
          email: business.email,
          phone: business.phone,
          website: business.website,
        },
        summary: {
          customers: {
            total: totalCustomers,
            emailOptedIn: emailOptedInCustomers,
            smsOptedIn: smsOptedInCustomers,
            unsubscribed: unsubscribedCustomers,
          },
          campaigns: {
            total: totalCampaigns,
            draft: draftCampaigns,
            queued: queuedCampaigns,
            sent: sentCampaigns,
            failed: failedCampaigns,
          },
          messages: {
            totalLogs: totalMessageLogs,
            sent: sentMessages,
            failed: failedMessages,
            pending: pendingMessages,
            successRate: messageSuccessRate,
          },
        },
        recentCampaigns,
      });
    },
  );

  businessRouter.get(
    "/:businessId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      const business = await db.business.findUnique({
        where: {
          id_ownerId: {
            id: businessId,
            ownerId: req.user!.id,
          },
        },
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      res.json(business);
    },
  );

  businessRouter.put(
    "/:businessId",
    requireAuth,
    validate(updateBusinessSchema),
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }
      const { name, description, email, phone, website } = req.body;

      const updatedBusiness = await db.business.update({
        where: {
          id_ownerId: {
            id: businessId,
            ownerId: req.user!.id,
          },
        },
        data: {
          name,
          description: description || null,
          email: email || null,
          phone: phone || null,
          website: website || null,
        },
      });

      res.json(updatedBusiness);
    },
  );

  businessRouter.delete(
    "/:businessId",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      await db.business.delete({
        where: {
          id_ownerId: {
            id: businessId,
            ownerId: req.user!.id,
          },
        },
      });

      res.status(204).send();
    },
  );

  return businessRouter;
}

export const businessRouter = createBusinessRouter();
