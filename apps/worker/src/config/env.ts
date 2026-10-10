import "dotenv/config";

type MessageMode = "fake" | "resend";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getMessageMode(): MessageMode {
  const mode = process.env.MESSAGE_MODE ?? "fake";
  if (mode !== "fake" && mode !== "resend") {
    throw new Error(`Invalid MESSAGE_MODE: ${mode}. Expected "fake" or "resend".`);
  }
  return mode;
}

const messageMode = getMessageMode();
const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const campaignSenderAllowlist = process.env.CAMPAIGN_SENDER_ALLOWLIST ?? "";

if (messageMode === "resend" && !resendApiKey) {
  throw new Error("RESEND_API_KEY is required when MESSAGE_MODE=resend");
}

if (messageMode === "resend" && !resendFromEmail) {
  throw new Error("RESEND_FROM_EMAIL is required when MESSAGE_MODE=resend");
}

if (
  messageMode === "resend" &&
  !campaignSenderAllowlist.split(",").some((id) => id.trim())
) {
  throw new Error(
    "CAMPAIGN_SENDER_ALLOWLIST must include an approved Supabase user ID when MESSAGE_MODE=resend",
  );
}

export const workerEnv = {
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  redisUrl: getRequiredEnv("REDIS_URL"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  campaignSenderAllowlist,
  messageMode,
  appUrl: process.env.APP_URL ?? "http://localhost:4000",
  resendApiKey,
  resendFromEmail,
};
