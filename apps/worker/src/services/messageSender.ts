import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { workerEnv } from "../config/env.js";

type MessageChannel = "EMAIL" | "SMS";

type SendMessageInput = {
  channel: MessageChannel;
  recipient: string;
  subject?: string;
  message: string;
  htmlMessage?: string;
};

type SendMessageResult = {
  success: boolean;
  errorMessage?: string;
};

const messageMode = workerEnv.messageMode;

export async function sendMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  if (messageMode === "fake") {
    return sendFakeMessage(input);
  }

  if (messageMode === "aws") {
    return sendAwsMessage(input);
  }

  return {
    success: false,
    errorMessage: `Unsupported MESSAGE_MODE: ${messageMode}`,
  };
}

async function sendFakeMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  console.log("FAKE MESSAGE SEND");
  console.log("Channel:", input.channel);
  console.log("Recipient:", input.recipient);
  console.log("Subject:", input.subject ?? "Promotion");
  console.log("Message:", input.message);

  if (input.htmlMessage) {
    console.log("HTML message enabled");
  }

  return { success: true };
}

async function sendAwsMessage(
  input: SendMessageInput
): Promise<SendMessageResult> {
  if (input.channel === "EMAIL") {
    return sendEmailWithSes(input);
  }

  if (input.channel === "SMS") {
    console.log("AWS SNS SMS sending is not implemented yet");

    return {
      success: false,
      errorMessage: "AWS SNS SMS sending is not implemented yet",
    };
  }

  return {
    success: false,
    errorMessage: `Unsupported channel: ${input.channel}`,
  };
}

async function sendEmailWithSes(
  input: SendMessageInput
): Promise<SendMessageResult> {
  const awsRegion = workerEnv.awsRegion;
  const fromEmail = workerEnv.sesFromEmail;

  if (!awsRegion) {
    return {
      success: false,
      errorMessage: "AWS_REGION is not configured",
    };
  }

  if (!fromEmail) {
    return {
      success: false,
      errorMessage: "SES_FROM_EMAIL is not configured",
    };
  }

  const sesClient = new SESClient({
    region: awsRegion,
  });

  try {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [input.recipient],
      },
      Message: {
        Subject: {
          Charset: "UTF-8",
          Data: input.subject ?? "Promotion",
        },
        Body: {
          Text: {
            Charset: "UTF-8",
            Data: input.message,
          },
          ...(input.htmlMessage
            ? {
                Html: {
                  Charset: "UTF-8",
                  Data: input.htmlMessage,
                },
              }
            : {}),
        },
      },
    });

    await sesClient.send(command);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown SES error";

    console.error("SES email send failed:", errorMessage);

    return {
      success: false,
      errorMessage,
    };
  }
}
