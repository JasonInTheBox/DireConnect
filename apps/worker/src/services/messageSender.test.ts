import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createResendEmailSender,
  createResendIdempotencyKey,
  sendMessage,
  type SendMessageInput,
} from "./messageSender.ts";

const emailInput: SendMessageInput = {
  channel: "EMAIL",
  recipient: "customer@example.com",
  subject: "Spring update",
  message: "A text campaign",
  htmlMessage: "<p>A text campaign</p>",
  idempotencyKey: "campaign-campaign-1-customer-customer-1",
};

function createClient(send: ReturnType<typeof vi.fn>) {
  return { emails: { send } } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Resend email adapter", () => {
  it("supports fake local email sending without exposing recipient or content in logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(sendMessage(emailInput)).resolves.toEqual({ success: true });

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls.flat().join(" ")).not.toContain(emailInput.recipient);
    expect(log.mock.calls.flat().join(" ")).not.toContain(emailInput.message);
  });

  it("sends one recipient with the configured sender and stable idempotency key", async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: "resend-email-1" },
      error: null,
      headers: {},
    });
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(sendEmail(emailInput)).resolves.toEqual({ success: true });

    expect(send).toHaveBeenCalledWith(
      {
        from: "promotions@direconnect.app",
        to: ["customer@example.com"],
        subject: "Spring update",
        text: "A text campaign",
        html: "<p>A text campaign</p>",
      },
      { idempotencyKey: createResendIdempotencyKey(emailInput.idempotencyKey!) },
    );
    const key = createResendIdempotencyKey(emailInput.idempotencyKey!);
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(createResendIdempotencyKey(emailInput.idempotencyKey!)).toBe(key);
    expect(key).not.toContain("customer-1");
  });

  it("returns a retryable result for rate limits and preserves Retry-After", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: {
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "rate limited",
      },
      headers: { "retry-after": "2" },
    });
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(sendEmail(emailInput)).resolves.toMatchObject({
      success: false,
      retryable: true,
      retryAfterMs: 2000,
      errorMessage: "Resend rejected the email (429): rate limited",
    });
  });

  it("does not retry permanent provider errors", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: {
        name: "invalid_from_address",
        statusCode: 400,
        message: "invalid sender",
      },
      headers: {},
    });
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(sendEmail(emailInput)).resolves.toMatchObject({
      success: false,
      retryable: false,
      errorMessage: "Resend rejected the email (400): invalid sender",
    });
  });

  it("retries concurrent requests using the same idempotency key", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: {
        name: "concurrent_idempotent_requests",
        statusCode: 409,
        message: "request with this idempotency key is already in progress",
      },
      headers: {},
    });
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(sendEmail(emailInput)).resolves.toMatchObject({
      success: false,
      retryable: true,
    });
    await expect(sendEmail(emailInput)).resolves.toMatchObject({
      success: false,
      retryable: true,
    });
    expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1]);
  });

  it("treats network failures as retryable", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network timeout"));
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(sendEmail(emailInput)).resolves.toMatchObject({
      success: false,
      retryable: true,
      errorMessage: "network timeout",
    });
  });

  it("blocks SMS before making any provider request", async () => {
    const send = vi.fn();
    const sendEmail = createResendEmailSender({
      apiKey: "test-api-key",
      fromEmail: "promotions@direconnect.app",
      client: createClient(send),
    });

    await expect(
      sendEmail({ ...emailInput, channel: "SMS", recipient: "5551234567" }),
    ).resolves.toEqual({
      success: false,
      errorMessage: "SMS sending is temporarily disabled.",
    });
    expect(send).not.toHaveBeenCalled();
  });
});
