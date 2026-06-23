import "dotenv/config";
import { prisma } from "@direconnect/db";

async function processQueuedCampaigns() {
    const campaigns = await prisma.campaign.findMany({
        where : {
            status: "QUEUED",
        },
        include: {
            business: {
                include: {
                    customers: true,
                },
            },
        },
    });

    console.log(`Found ${campaigns.length} queued campaigns`);

    for (const campaign of campaigns) {
        console.log(`Processing campaign ${campaign.title}`);

        for(const customer of campaign.business.customers) {
            const recipient = campaign.channel === "EMAIL" ? customer.email : customer.phone;

            if (!recipient) {
                console.log(`[SKIPPED] Customer ${customer.id} has no ${campaign.channel} recipient`);

                await prisma.messageLog.create({
                    data: {
                        ownerId: campaign.ownerId,
                        businessId: campaign.businessId,
                        campaignId: campaign.id,
                        customerId: customer.id,
                        channel: campaign.channel,
                        recipient: "MISSING",
                        status: "FAILED",
                        errorMessage: `Customer has no ${campaign.channel} recipient`,
                        sentAt: null,
                    },
                });

                continue;
            }

            if (campaign.channel === "EMAIL") {
                console.log(`[FAKE EMAIL] To ${customer.email} | Message: ${campaign.message}`);
            }

            if (campaign.channel === "SMS") {
                console.log(`[FAKE SMS] To ${customer.phone} | Message: ${campaign.message}`);
            }

            await prisma.messageLog.create({
                data: {
                ownerId: campaign.ownerId,
                businessId: campaign.businessId,
                campaignId: campaign.id,
                customerId: customer.id,
                channel: campaign.channel,
                recipient,
                status: "SENT",
                sentAt: new Date(),
                },
            });
        }

        await prisma.campaign.update({
            where: {
                id: campaign.id,
            },
            data: {
                status: "SENT",
            }
        });

        console.log(`Campaign marked as SENT: ${campaign.title}`);
    }
}

processQueuedCampaigns()
    .then(() => {
        console.log("Worker finished");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
