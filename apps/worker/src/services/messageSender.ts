import { createHash } from "node:crypto";
import { Resend, type CreateEmailRequestOptions } from "resend";
import { workerEnv } from "../config/env.js";

export type MessageChannel = "EMAIL" | "SMS";

export type SendMessageInput = {
  channel: MessageChannel;
  recipient: string;
  subject?: string;
  message: string;
  htmlMessage?: string;
  idempotencyKey?: string;
};

export type SendMessageResult = {
  success: boolean;
  errorMessage?: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

type ResendClient = Pick<Resend, "emails">;

type ResendEmailConfig = {
  apiKey: string;
  fromEmail: string;
  client?: ResendClient;
};

function getRetryAfterMs(headers: Record<string, string> | null): number | undefined {
  const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Resend accepts idempotency keys up to 256 characters; a hash keeps recipient PII out of headers. */
export function createResendIdempotencyKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

/** Creates an SDK-backed adapter that can be tested without contacting Resend. */
export function createResendEmailSender({
  apiKey,
  fromEmail,
  client = new Resend(apiKey),
}: ResendEmailConfig) {
  return async (input: SendMessageInput): Promise<SendMessageResult> => {
    if (input.channel !== "EMAIL") {
      return { success: false, errorMessage: "SMS sending is temporarily disabled." };
    }

    try {
      const requestOptions: CreateEmailRequestOptions | undefined = input.idempotencyKey
        ? { idempotencyKey: createResendIdempotencyKey(input.idempotencyKey) }
        : undefined;
      const result = await client.emails.send(
        {
          from: fromEmail,
          to: [input.recipient],
          subject: input.subject ?? "Promotion",
          text: input.message,
          ...(input.htmlMessage ? { html: input.htmlMessage } : {}),
        },
        requestOptions,
      );

      if (result.error) {
        const { error, headers } = result;
        const retryAfterMs = getRetryAfterMs(headers);
        const retryable =
          error.statusCode === 429 ||
          (error.statusCode !== null && error.statusCode >= 500) ||
          error.name === "concurrent_idempotent_requests";
        console.warn("Resend email request failed", {
          code: error.name,
          statusCode: error.statusCode,
          retryable,
        });
        return {
          success: false,
          errorMessage: `Resend rejected the email (${error.statusCode ?? "unknown"}): ${error.message}`,
          retryable,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
      }

      console.info("Resend accepted campaign email", { emailId: result.data.id });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Resend request failed";
      console.warn("Resend email request failed before a response was received", {
        error: errorMessage,
        retryable: true,
      });
      return {
        success: false,
        errorMessage,
        retryable: true,
      };
    }
  };
}

const sendResendEmail = workerEnv.messageMode === "resend"
  ? createResendEmailSender({
      apiKey: workerEnv.resendApiKey!,
      fromEmail: workerEnv.resendFromEmail!,
    })
  : null;

export async function sendMessage(
  input: SendMessageInput,
): Promise<SendMessageResult> {
  // Keep this guard ahead of every provider path so SMS can never reach an API.
  if (input.channel === "SMS") {
    return { success: false, errorMessage: "SMS sending is temporarily disabled." };
  }

  if (workerEnv.messageMode === "fake") {
    console.log("Development email simulation completed; recipient and content were not logged.");
    return { success: true };
  }

  if (workerEnv.messageMode === "resend" && sendResendEmail) {
    return sendResendEmail(input);
  }

  return {
    success: false,
    errorMessage: `Unsupported MESSAGE_MODE: ${workerEnv.messageMode}`,
  };
}
