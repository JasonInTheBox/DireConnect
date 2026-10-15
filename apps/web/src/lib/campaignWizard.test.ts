import { describe, expect, it } from "vitest";
import {
  campaignPayload,
  canSaveDraft,
  confirmCopy,
  sendBlocks,
  submitLabel,
  successMessage,
  validateStep,
  WIZARD_STEPS,
  wizardValues,
  type WizardValues,
} from "./campaignWizard";

const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute);
const now = local(2030, 1, 15, 9, 0);

function values(overrides: Partial<WizardValues> = {}): WizardValues {
  return {
    title: "Autumn menu",
    message: "Fresh loaves.",
    timing: "now",
    scheduledAt: "",
    audience: "ALL",
    ...overrides,
  };
}

describe("WIZARD_STEPS", () => {
  it("lists the four steps in order", () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual([
      "basics",
      "recipients",
      "message",
      "review",
    ]);
  });
});

describe("wizardValues", () => {
  it("starts empty for a new campaign", () => {
    expect(wizardValues(null, now)).toEqual({
      title: "",
      message: "",
      timing: "now",
      scheduledAt: "",
      audience: "ALL",
    });
  });

  it("loads a draft and opens a future send time as a schedule in local time", () => {
    const sendAt = local(2030, 1, 20, 9, 30).toISOString();
    expect(
      wizardValues({ title: "Hi", message: "Body", sendAt, targetAudience: "ALL" }, now),
    ).toEqual({
      title: "Hi",
      message: "Body",
      timing: "schedule",
      scheduledAt: "2030-01-20T09:30",
      audience: "ALL",
    });
  });

  it("opens a draft with a past send time as Send now, with no error", () => {
    const sendAt = local(2030, 1, 10, 9, 30).toISOString();
    const result = wizardValues(
      { title: "Hi", message: "Body", sendAt, targetAudience: "ALL" },
      now,
    );
    expect(result.timing).toBe("now");
    expect(result.scheduledAt).toBe("");
  });

  it("preserves an email opted-in audience and maps anything else to ALL", () => {
    const base = { title: "Hi", message: "Body", sendAt: null };
    expect(wizardValues({ ...base, targetAudience: "EMAIL_OPTED_IN" }, now).audience).toBe(
      "EMAIL_OPTED_IN",
    );
    expect(wizardValues({ ...base, targetAudience: "SMS_OPTED_IN" }, now).audience).toBe("ALL");
  });
});

describe("validateStep", () => {
  it("requires a campaign name, ignoring whitespace", () => {
    expect(validateStep("basics", values({ title: "" }), now)).toEqual({
      title: "Enter a campaign name.",
    });
    expect(validateStep("basics", values({ title: "   " }), now)).toEqual({
      title: "Enter a campaign name.",
    });
    expect(validateStep("basics", values(), now)).toEqual({});
  });

  it("requires a message, ignoring whitespace", () => {
    expect(validateStep("message", values({ message: " \n " }), now)).toEqual({
      message: "Write the message your customers will read.",
    });
    expect(validateStep("message", values(), now)).toEqual({});
  });

  it("has nothing to validate on Recipients", () => {
    expect(validateStep("recipients", values({ title: "", message: "" }), now)).toEqual({});
  });

  it("validates the schedule only when scheduling", () => {
    expect(validateStep("review", values({ timing: "now", scheduledAt: "" }), now)).toEqual({});
    expect(validateStep("review", values({ timing: "schedule", scheduledAt: "" }), now)).toEqual({
      scheduledAt: "Choose a date and time.",
    });
    expect(
      validateStep("review", values({ timing: "schedule", scheduledAt: "2030-01-14T09:00" }), now),
    ).toEqual({ scheduledAt: "Choose a time in the future." });
    expect(
      validateStep("review", values({ timing: "schedule", scheduledAt: "2030-01-16T09:00" }), now),
    ).toEqual({});
  });
});

describe("canSaveDraft", () => {
  it("needs a name and a message", () => {
    expect(canSaveDraft(values())).toBe(true);
    expect(canSaveDraft(values({ title: "  " }))).toBe(false);
    expect(canSaveDraft(values({ message: "" }))).toBe(false);
  });
});

describe("campaignPayload", () => {
  it("sends an email campaign with an empty sendAt for Send now", () => {
    expect(campaignPayload(values({ title: "  Autumn menu ", message: " Fresh loaves. " }))).toEqual({
      title: "Autumn menu",
      message: "Fresh loaves.",
      channel: "EMAIL",
      targetAudience: "ALL",
      sendAt: "",
    });
  });

  it("sends the schedule as an ISO instant", () => {
    const payload = campaignPayload(values({ timing: "schedule", scheduledAt: "2030-01-20T09:30" }));
    expect(payload.sendAt).toBe(local(2030, 1, 20, 9, 30).toISOString());
  });

  it("clears sendAt when scheduling with an unusable value", () => {
    expect(campaignPayload(values({ timing: "schedule", scheduledAt: "" })).sendAt).toBe("");
    expect(campaignPayload(values({ timing: "schedule", scheduledAt: "junk" })).sendAt).toBe("");
  });

  it("preserves a legacy audience", () => {
    expect(campaignPayload(values({ audience: "EMAIL_OPTED_IN" })).targetAudience).toBe(
      "EMAIL_OPTED_IN",
    );
  });
});

describe("sendBlocks", () => {
  it("blocks nothing for a normal campaign", () => {
    expect(sendBlocks({ eligibleCount: 3, emailConfirmed: true })).toEqual([]);
    expect(sendBlocks({ eligibleCount: 10, emailConfirmed: true })).toEqual([]);
  });

  it("blocks zero recipients", () => {
    const blocks = sendBlocks({ eligibleCount: 0, emailConfirmed: true });
    expect(blocks.map((block) => block.code)).toEqual(["no-recipients"]);
  });

  it("blocks more than the limit and states both numbers", () => {
    const blocks = sendBlocks({ eligibleCount: 11, emailConfirmed: true });
    expect(blocks.map((block) => block.code)).toEqual(["over-limit"]);
    expect(blocks[0].message).toContain("10");
    expect(blocks[0].message).toContain("11");
  });

  it("blocks an unconfirmed email address", () => {
    expect(sendBlocks({ eligibleCount: 3, emailConfirmed: false }).map((b) => b.code)).toEqual([
      "email-unconfirmed",
    ]);
  });

  it("links the unconfirmed-email block to the Account page and no other block", () => {
    const blocks = sendBlocks({ eligibleCount: 0, emailConfirmed: false });
    expect(blocks.find((b) => b.code === "email-unconfirmed")?.action).toEqual({
      label: "Open Account",
      href: "/account",
    });
    expect(blocks.find((b) => b.code === "no-recipients")?.action).toBeUndefined();
    expect(
      sendBlocks({ eligibleCount: 11, emailConfirmed: true }).find((b) => b.code === "over-limit")
        ?.action,
    ).toBeUndefined();
  });

  it("reports every applicable block", () => {
    expect(sendBlocks({ eligibleCount: 0, emailConfirmed: false }).map((b) => b.code)).toEqual([
      "no-recipients",
      "email-unconfirmed",
    ]);
  });
});

describe("confirmCopy and labels", () => {
  it("words the Send now confirmation", () => {
    expect(confirmCopy({ recipientCount: 1, timing: "now", scheduledLabel: "" })).toEqual({
      title: "Send to 1 customer now?",
      description: "Queued campaigns can’t be edited or cancelled.",
      confirmLabel: "Send now",
    });
    expect(confirmCopy({ recipientCount: 4, timing: "now", scheduledLabel: "" }).title).toBe(
      "Send to 4 customers now?",
    );
  });

  it("words the Schedule confirmation with the time", () => {
    const copy = confirmCopy({
      recipientCount: 2,
      timing: "schedule",
      scheduledLabel: "Jan 20, 2030, 9:30 AM",
    });
    expect(copy.title).toBe("Schedule for 2 customers?");
    expect(copy.description).toContain("Jan 20, 2030, 9:30 AM");
    expect(copy.description).toContain("can’t be edited or cancelled");
    expect(copy.confirmLabel).toBe("Schedule campaign");
  });

  it("labels the submit button and the success toast", () => {
    expect(submitLabel("now")).toBe("Send now");
    expect(submitLabel("schedule")).toBe("Schedule campaign");
    expect(successMessage("now")).toBe("Campaign queued");
    expect(successMessage("schedule")).toBe("Campaign scheduled");
  });
});
