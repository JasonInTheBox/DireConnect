import type { MessageLog, Prisma } from "../generated/prisma/client.js";
import { prisma } from "./client.js";

export type CampaignEmailQuotaLimits = {
  perAccount: number;
  perPlatform: number;
  perRecipient: number;
};

export type CampaignEmailReservation =
  | { status: "reserved" | "already-sent"; log: MessageLog }
  | { status: "blocked"; log: MessageLog; reason: string };

type ReserveCampaignEmailInput = {
  ownerId: string;
  businessId: string;
  campaignId: string;
  customerId: string;
  recipient: string;
  now: Date;
  limits: CampaignEmailQuotaLimits;
};

/**
 * Persist a pending message before calling the provider, and atomically enforce
 * rolling 24-hour caps across all API/worker processes. PostgreSQL transaction
 * advisory locks serialize quota checks; PENDING rows reserve a send slot so a
 * worker retry doesn't consume a second slot for the same delivery.
 */
export async function reserveCampaignEmailSend({
  ownerId,
  businessId,
  campaignId,
  customerId,
  recipient,
  now,
  limits,
}: ReserveCampaignEmailInput): Promise<CampaignEmailReservation> {
  const normalizedRecipient = recipient.trim().toLowerCase();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    // Acquire locks in a consistent order to avoid deadlocks.
    // Prisma's PostgreSQL adapter cannot deserialize a raw `void` result. Keep
    // the lock call inside a subquery and return an ordinary integer instead.
    const acquireLock = (key: string) => tx.$queryRaw`
      SELECT 1::int AS acquired
      FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS advisory_lock
    `;
    await acquireLock("direconnect:campaign-email:platform");
    await acquireLock(`owner:${ownerId}`);
    await acquireLock(`recipient:${normalizedRecipient}`);

    const existing = await tx.messageLog.findFirst({
      where: { campaignId, customerId, ownerId, businessId },
      orderBy: { createdAt: "desc" },
    });

    if (existing?.status === "SENT") {
      return { status: "already-sent", log: existing };
    }

    // Refreshing updatedAt makes an old, interrupted reservation count against
    // the current window before it is retried.
    const pendingLog = existing?.status === "PENDING"
      ? await tx.messageLog.update({
          where: { id: existing.id },
          data: {
            recipient,
            errorMessage: null,
            sentAt: null,
          },
        })
      : null;

    const recentUsage: Prisma.MessageLogWhereInput = {
      channel: "EMAIL",
      status: { in: ["PENDING", "SENT"] },
      updatedAt: { gte: cutoff },
    };

    const [platformCount, accountCount, recipientCount] = await Promise.all([
      tx.messageLog.count({ where: recentUsage }),
      tx.messageLog.count({ where: { ...recentUsage, ownerId } }),
      tx.messageLog.count({
        where: {
          ...recentUsage,
          recipient: { equals: normalizedRecipient, mode: "insensitive" },
        },
      }),
    ]);

    const reasons: string[] = [];
    const reservationAlreadyExists = pendingLog !== null;
    const accountLimitExceeded = reservationAlreadyExists
      ? accountCount > limits.perAccount
      : accountCount >= limits.perAccount;
    const platformLimitExceeded = reservationAlreadyExists
      ? platformCount > limits.perPlatform
      : platformCount >= limits.perPlatform;
    const recipientLimitExceeded = reservationAlreadyExists
      ? recipientCount > limits.perRecipient
      : recipientCount >= limits.perRecipient;

    if (accountLimitExceeded) {
      reasons.push("This account reached its email sending limit for the last 24 hours.");
    }
    if (platformLimitExceeded) {
      reasons.push("DireConnect reached its platform email sending limit for the last 24 hours.");
    }
    if (recipientLimitExceeded) {
      reasons.push("This recipient already received a campaign email in the last 24 hours.");
    }

    if (reasons.length > 0) {
      const reason = reasons.join(" ");
      const log = pendingLog
        ? await tx.messageLog.update({
            where: { id: pendingLog.id },
            data: { status: "FAILED", errorMessage: reason, sentAt: null },
          })
        : await tx.messageLog.create({
            data: {
              ownerId,
              businessId,
              campaignId,
              customerId,
              channel: "EMAIL",
              recipient,
              status: "FAILED",
              errorMessage: reason,
              sentAt: null,
            },
          });

      return { status: "blocked", log, reason };
    }

    const log = pendingLog ?? await tx.messageLog.create({
      data: {
        ownerId,
        businessId,
        campaignId,
        customerId,
        channel: "EMAIL",
        recipient,
        status: "PENDING",
        errorMessage: null,
        sentAt: null,
      },
    });

    return { status: "reserved", log };
  });
}
