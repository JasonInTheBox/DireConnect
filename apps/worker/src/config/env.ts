import "dotenv/config";

type MessageMode = "fake" | "aws";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getMessageMode(): MessageMode {
  const mode = process.env.MESSAGE_MODE ?? "fake";

  if (mode !== "fake" && mode !== "aws") {
    throw new Error(
      `Invalid MESSAGE_MODE: ${mode}. Expected "fake" or "aws".`
    );
  }

  return mode;
}

const messageMode = getMessageMode();

const baseWorkerEnv = {
  databaseUrl: getRequiredEnv("DATABASE_URL"),
  redisUrl: getRequiredEnv("REDIS_URL"),
  messageMode,
  appUrl: process.env.APP_URL ?? "http://localhost:4000",
};

const awsWorkerEnv =
  messageMode === "aws"
    ? {
        awsRegion: process.env.AWS_REGION,
        sesFromEmail: process.env.SES_FROM_EMAIL,
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : {
        awsRegion: process.env.AWS_REGION,
        sesFromEmail: process.env.SES_FROM_EMAIL,
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };

export const workerEnv = {
  ...baseWorkerEnv,
  ...awsWorkerEnv,
};
