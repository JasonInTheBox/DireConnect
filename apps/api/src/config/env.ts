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
    supabaseJwtSecret: getRequiredEnv("SUPABASE_JWT_SECRET"),
    redisUrl: getRequiredEnv("REDIS_URL"),
    clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
    port: process.env.PORT ?? "4000",
};
