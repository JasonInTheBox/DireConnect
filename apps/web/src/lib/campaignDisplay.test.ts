import { describe, expect, it } from "vitest";
import {
  deliveryLabel,
  editBlockReason,
  plainSkipReason,
  rowActionsFor,
  skippedReasons,
  whenLabel,
} from "./campaignDisplay";

const now = new Date("2030-01-15T12:00:00.000Z");
const updatedAt = "2030-01-10T08:00:00.000Z";

describe("whenLabel", () => {
  it("explains a draft", () => {
    expect(whenLabel({ status: "DRAFT", sendAt: null, updatedAt }, now, "UTC")).toBe("Not scheduled");
    expect(
      whenLabel({ status: "DRAFT", sendAt: "2030-02-01T09:30:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Planned for Feb 1, 2030/);
  });

  it("does not call a draft with a send time in the past planned", () => {
    expect(
      whenLabel({ status: "DRAFT", sendAt: "2030-01-01T09:30:00.000Z", updatedAt }, now, "UTC"),
    ).toBe("Not scheduled");
  });

  it("says a queued campaign without a future time is waiting to be sent", () => {
    expect(whenLabel({ status: "QUEUED", sendAt: null, updatedAt }, now, "UTC")).toBe(
      "Waiting to be sent",
    );
    expect(
      whenLabel({ status: "QUEUED", sendAt: "2030-01-14T09:00:00.000Z", updatedAt }, now, "UTC"),
    ).toBe("Waiting to be sent");
  });

  it("shows the time of a scheduled campaign", () => {
    expect(
      whenLabel({ status: "QUEUED", sendAt: "2030-02-01T09:30:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Feb 1, 2030/);
  });

  it("uses the send time, or when the campaign last changed", () => {
    expect(
      whenLabel({ status: "SENT", sendAt: "2030-01-12T10:00:00.000Z", updatedAt }, now, "UTC"),
    ).toMatch(/^Jan 12, 2030/);
    expect(whenLabel({ status: "FAILED", sendAt: null, updatedAt }, now, "UTC")).toMatch(
      /^Jan 10, 2030/,
    );
  });
});

describe("deliveryLabel", () => {
  const sent = { status: "SENT" } as const;
  const ready = (
    eligibleCount: number,
    sentCount: number,
    failedDeliveryCount = 0,
    pendingCount = 0,
  ) => ({
    status: "ready" as const,
    summary: { eligibleCount, sentCount, failedDeliveryCount, pendingCount },
  });

  it("never asks for numbers for a draft", () => {
    expect(deliveryLabel({ status: "DRAFT" }, undefined)).toBe("Not sent yet");
  });

  it("says when the numbers are loading or unavailable", () => {
    expect(deliveryLabel(sent, undefined)).toBe("Loading…");
    expect(deliveryLabel(sent, { status: "loading" })).toBe("Loading…");
    expect(deliveryLabel(sent, { status: "error" })).toBe("Unavailable");
  });

  it("summarises sent, failed and pending", () => {
    expect(deliveryLabel(sent, ready(4, 3, 1))).toBe("3 of 4 sent, 1 failed");
    expect(deliveryLabel(sent, ready(3, 1, 0, 2))).toBe("1 of 3 sent, 2 pending");
    expect(deliveryLabel(sent, ready(5, 5))).toBe("5 of 5 sent");
    expect(deliveryLabel({ status: "QUEUED" }, ready(2, 0))).toBe("0 of 2 sent");
  });

  it("handles a campaign with no recipients", () => {
    expect(deliveryLabel(sent, ready(0, 0))).toBe("No recipients");
  });
});

describe("rowActionsFor", () => {
  it("offers edit and delete for email drafts", () => {
    expect(rowActionsFor({ status: "DRAFT", channel: "EMAIL" })).toEqual(["edit", "delete"]);
  });

  it("offers only delete for an SMS draft", () => {
    expect(rowActionsFor({ status: "DRAFT", channel: "SMS" })).toEqual(["delete"]);
  });

  it("offers nothing once a campaign is queued, sent or failed", () => {
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(rowActionsFor({ status, channel: "EMAIL" })).toEqual([]);
    }
  });
});

describe("editBlockReason", () => {
  it("allows editing an email draft", () => {
    expect(editBlockReason({ status: "DRAFT", channel: "EMAIL" })).toBeNull();
  });

  it("explains why SMS and non-draft campaigns cannot be edited", () => {
    expect(editBlockReason({ status: "DRAFT", channel: "SMS" })).toMatch(/SMS/);
    expect(editBlockReason({ status: "SENT", channel: "EMAIL" })).toMatch(/can’t be edited/);
    expect(editBlockReason({ status: "QUEUED", channel: "EMAIL" })).toMatch(/can’t be edited/);
  });
});

describe("plainSkipReason / skippedReasons", () => {
  it("translates the API's reasons", () => {
    expect(plainSkipReason("Customer has no EMAIL recipient")).toBe("No email address");
    expect(plainSkipReason("Customer has unsubscribed")).toBe("Hasn’t agreed to receive emails");
    expect(plainSkipReason("Customer has not opted in to EMAIL")).toBe(
      "Hasn’t agreed to receive emails",
    );
    expect(plainSkipReason("Customer does not match campaign audience: SMS_OPTED_IN")).toBe(
      "Not in this campaign’s audience",
    );
    expect(plainSkipReason("Something new")).toBe("Something new");
    expect(plainSkipReason(null)).toBe("Not eligible");
  });

  it("merges reasons that read the same and sorts by count", () => {
    // The API stores "unsubscribed" for people who never opted in, so both read as one reason.
    expect(
      skippedReasons({
        "Customer has unsubscribed": 2,
        "Customer has not opted in to EMAIL": 1,
        "Customer has no EMAIL recipient": 1,
      }),
    ).toEqual([
      { label: "Hasn’t agreed to receive emails", count: 3 },
      { label: "No email address", count: 1 },
    ]);
  });

  it("returns nothing when no one was skipped", () => {
    expect(skippedReasons({})).toEqual([]);
  });
});
