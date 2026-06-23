type CampaignEmailTemplateInput = {
    businessName: string;
    campaignTitle: string;
    message: string;
    unsubscribeLink: string | null;
    website?: string | null;
};

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatMessageAsHtml(message: string) {
    return escapeHtml(message).replaceAll("\n", "<br>");
}

export function buildCampaignEmailHtml(input: CampaignEmailTemplateInput) {
    const businessName = escapeHtml(input.businessName);
    const campaignTitle = escapeHtml(input.campaignTitle);
    const messageHtml = formatMessageAsHtml(input.message);

    const websiteButton = input.website
        ? `
            <a href="${escapeHtml(input.website)}"
            style="
                display: inline-block;
                margin-top: 20px;
                padding: 12px 18px;
                background-color: #2563eb;
                color: #ffffff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                "
            >
                Visit Website
              </a>
            `
            : "";

    const unsubscribeHtml = input.unsubscribeLink
        ? `
            <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
                You are receiving this email because you opted in to promotions from ${businessName}.
                <br />
                <a href="${escapeHtml(input.unsubscribeLink)}" style="color: #6b7280;">
                    Unsubscribe
                </a>
            </p>
        `
        : "";

        return `
        <!doctype html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
            <div style="max-width: 640px; margin: 0 auto; padding: 32px 16px;">
            <div style="background-color: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb;">
                <div style="background-color: #111827; padding: 24px;">
                <p style="margin: 0; color: #93c5fd; font-size: 14px; font-weight: 600;">
                    Promotion from
                </p>
                <h1 style="margin: 8px 0 0; color: #ffffff; font-size: 26px;">
                    ${businessName}
                </h1>
                </div>

                <div style="padding: 28px;">
                <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px;">
                    ${campaignTitle}
                </h2>

                <div style="color: #374151; font-size: 16px; line-height: 1.6;">
                    ${messageHtml}
                </div>

                ${websiteButton}

                ${unsubscribeHtml}
                </div>
            </div>

            <p style="margin-top: 16px; text-align: center; font-size: 12px; color: #9ca3af;">
                Powered by DireConnect
            </p>
            </div>
        </body>
        </html>
        `;
}
