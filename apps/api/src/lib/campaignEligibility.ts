type CustomerLike = {
    id: string;
    email: string | null;
    phone: string | null;
    emailOptIn: boolean;
    smsOptIn: boolean;
    unsubscribedAt: Date | null;
}

type campaignLike = {
    channel: "EMAIL" | "SMS"
    targetAudience: "ALL" | "EMAIL_OPTED_IN" | "SMS_OPTED_IN";
}

export type CampaignEligibilityResult = {
    customerId: string;
    recipient: string | null;
    eligible: boolean;
    reason: string | null;
}

export function getCampaignEligibility(
    campaign: campaignLike,
    customer: CustomerLike
): CampaignEligibilityResult {
    const recipient = campaign.channel === "EMAIL" ? customer.email : customer.phone;

    const matchesAudience = campaign.targetAudience === "ALL" || (campaign.targetAudience === "EMAIL_OPTED_IN" && customer.emailOptIn) || (campaign.targetAudience === "SMS_OPTED_IN" && customer.smsOptIn);

    if (!matchesAudience) {
        return {
            customerId: customer.id,
            recipient, 
            eligible: false,
            reason: `Customer does not match campaign audience: ${campaign.targetAudience}`,
        };
    }

    const hasOptedIn = campaign.channel === "EMAIL" ? customer.emailOptIn : customer.smsOptIn;

    if (!hasOptedIn || customer.unsubscribedAt) {
        return {
            customerId: customer.id,
            recipient,
            eligible: false,
            reason: customer.unsubscribedAt ? "Customer has unsubscribed" : `Customer has not opted in to ${campaign.channel}`,
        };
    }

    if (!recipient) {
        return {
            customerId: customer.id,
            recipient: null,
            eligible: false,
            reason: `Customer has no ${campaign.channel} recipient`,
        };
    }

    return {
        customerId: customer.id,
        recipient,
        eligible: true,
        reason: null,
    };
}
