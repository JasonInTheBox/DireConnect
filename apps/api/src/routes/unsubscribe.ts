import { Router } from "express";
import { prisma } from "@direconnect/db";

export const unsubscribeRouter = Router();

unsubscribeRouter.get("/:token", async (req, res) => {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Invalid subscribe link." });
    }

    const customer = await prisma.customer.findUnique({
        where: {
            unsubscribeToken: token,
        },
    });

    if (!customer) {
        return res.status(404).send("Unsubscribe link not found.");
    }

    await prisma.customer.update({
        where: {
            id: customer.id,
        },
        data: {
            emailOptIn: false,
            smsOptIn: false,
            unsubscribedAt: new Date(),
        },
    });

    res.send("You have been unsubscribed from future promotions.");
})
