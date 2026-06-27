import { Router } from "express";
import { prisma } from "@direconnect/db";
import { createCustomerSchema } from "@direconnect/validation";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import crypto from "crypto";
import type { AuthenticatedRequest } from "../middleware/requireAuth.js";

function getParam(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function createCustomerRouter(
  db: typeof prisma = prisma,
  authMiddleware = requireAuth,
) {
  const customerRouter = Router({ mergeParams: true });

  async function verifyBusinessOwnership(businessId: string, ownerId: string) {
    return db.business.findUnique({
      where: {
        id_ownerId: {
          id: businessId,
          ownerId,
        },
      },
    });
  }

  customerRouter.get(
    "/",
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      const business = await verifyBusinessOwnership(businessId, req.user!.id);

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const customers = await db.customer.findMany({
        where: {
          businessId,
          ownerId: req.user!.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json(customers);
    },
  );

  customerRouter.post(
    "/",
    authMiddleware,
    validate(createCustomerSchema),
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      const { firstName, lastName, email, phone, emailOptIn, smsOptIn } =
        req.body;

      const business = await verifyBusinessOwnership(businessId, req.user!.id);

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const nextEmailOptIn = emailOptIn ?? true;
      const nextSmsOptIn = smsOptIn ?? false;
      const isSubscribedToAnyChannel = nextEmailOptIn || nextSmsOptIn;

      const customer = await db.customer.create({
        data: {
          ownerId: req.user!.id,
          businessId,
          firstName,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          emailOptIn: nextEmailOptIn,
          smsOptIn: nextSmsOptIn,
          unsubscribedAt: isSubscribedToAnyChannel ? null : new Date(),
          unsubscribeToken: crypto.randomUUID(),
        },
      });

      res.status(201).json(customer);
    },
  );

  customerRouter.put(
    "/:customerId",
    authMiddleware,
    validate(createCustomerSchema),
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);
      const customerId = getParam(req.params.customerId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      if (!customerId) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      const { firstName, lastName, email, phone, emailOptIn, smsOptIn } =
        req.body;

      const business = await verifyBusinessOwnership(businessId, req.user!.id);

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const nextEmailOptIn = emailOptIn ?? false;
      const nextSmsOptIn = smsOptIn ?? false;
      const isSubscribedToAnyChannel = nextEmailOptIn || nextSmsOptIn;

      const result = await db.customer.updateMany({
        where: {
          id: customerId,
          businessId,
          ownerId: req.user!.id,
        },
        data: {
          firstName,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          emailOptIn: nextEmailOptIn,
          smsOptIn: nextSmsOptIn,
          unsubscribedAt: isSubscribedToAnyChannel ? null : new Date(),
        },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const updatedCustomer = await db.customer.findFirst({
        where: {
          id: customerId,
          businessId,
          ownerId: req.user!.id,
        },
      });

      res.json(updatedCustomer);
    },
  );

  customerRouter.delete(
    "/:customerId",
    authMiddleware,
    async (req: AuthenticatedRequest, res) => {
      const businessId = getParam(req.params.businessId);
      const customerId = getParam(req.params.customerId);

      if (!businessId) {
        return res.status(400).json({ error: "Invalid business ID" });
      }

      if (!customerId) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      const business = await verifyBusinessOwnership(businessId, req.user!.id);

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const result = await db.customer.deleteMany({
        where: {
          id: customerId,
          businessId,
          ownerId: req.user!.id,
        },
      });

      if (result.count === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }

      res.status(204).send();
    },
  );

  return customerRouter;
}

export const customerRouter = createCustomerRouter();
