import "dotenv/config";

function getRequiredEnv(name: string) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

export const apiEnv = {
    databaseUrl: getRequiredEnv("DATABASE_URL"),
    supabaseUrl: getRequiredEnv("SUPABASE_URL"),
    redisUrl: getRequiredEnv("REDIS_URL"),
    nodeEnv: process.env.NODE_ENV ?? "development",
    campaignSenderAllowlist: process.env.CAMPAIGN_SENDER_ALLOWLIST ?? "",
    clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
    port: process.env.PORT ?? "4000",
};
