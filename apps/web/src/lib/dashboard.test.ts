import { describe, expect, it } from "vitest";
import {
  campaignHref,
  deliverySegments,
  formatDate,
  notOptedInCount,
  setupSteps,
  shareLabel,
  showSetupChecklist,
  successRateLabel,
} from "./dashboard";
import type { DashboardSummary } from "./types";

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    customers: { total: 0, emailOptedIn: 0, smsOptedIn: 0, unsubscribed: 0 },
    campaigns: { total: 0, draft: 0, queued: 0, sent: 0, failed: 0 },
    messages: { totalLogs: 0, sent: 0, failed: 0, pending: 0, successRate: null },
    ...overrides,
  };
}

describe("notOptedInCount", () => {
  it("is everyone who is not opted in, never the API's unsubscribed count", () => {
    // 10 customers, 6 opted in. The API would report `unsubscribed: 4` here, but it also
    // counts people who never opted in, so the dashboard derives the number itself.
    expect(notOptedInCount({ total: 10, emailOptedIn: 6 })).toBe(4);
  });

  it("never goes negative", () => {
    expect(notOptedInCount({ total: 2, emailOptedIn: 5 })).toBe(0);
    expect(notOptedInCount({ total: 0, emailOptedIn: 0 })).toBe(0);
  });
});

describe("shareLabel", () => {
  it("is 0% only when the count is zero (or there is no total)", () => {
    expect(shareLabel(0, 10)).toBe("0%");
    expect(shareLabel(0, 0)).toBe("0%");
    expect(shareLabel(5, 0)).toBe("0%");
  });

  it("is 100% only when the count is the whole total", () => {
    expect(shareLabel(10, 10)).toBe("100%");
  });

  it("rounds ordinary shares to a whole percent", () => {
    expect(shareLabel(5, 10)).toBe("50%");
    expect(shareLabel(1, 3)).toBe("33%");
  });

  it("never rounds a non-zero share down to 0% or a partial share up to 100%", () => {
    expect(shareLabel(1, 1000)).toBe("<1%");
    expect(shareLabel(4, 1000)).toBe("<1%");
    expect(shareLabel(999, 1000)).toBe(">99%");
    expect(shareLabel(995, 1000)).toBe(">99%");
    expect(shareLabel(994, 1000)).toBe("99%");
    expect(shareLabel(5, 1000)).toBe("1%");
  });
});

describe("deliverySegments", () => {
  it("returns nothing when no messages exist, so the page shows the empty message", () => {
    expect(deliverySegments({ sent: 0, failed: 0, pending: 0 })).toEqual([]);
  });

  it("returns every state, including zeros, with counts, percentages and share labels", () => {
    expect(deliverySegments({ sent: 8, failed: 1, pending: 1 })).toEqual([
      { key: "sent", label: "Sent", count: 8, percent: 80, share: "80%" },
      { key: "failed", label: "Failed", count: 1, percent: 10, share: "10%" },
      { key: "pending", label: "Pending", count: 1, percent: 10, share: "10%" },
    ]);
    expect(deliverySegments({ sent: 5, failed: 0, pending: 0 })).toEqual([
      { key: "sent", label: "Sent", count: 5, percent: 100, share: "100%" },
      { key: "failed", label: "Failed", count: 0, percent: 0, share: "0%" },
      { key: "pending", label: "Pending", count: 0, percent: 0, share: "0%" },
    ]);
  });

  it("keeps a tiny share visible in the numbers and never reads 100% beside a failure", () => {
    const tiny = deliverySegments({ sent: 1000, failed: 1, pending: 0 });
    expect(tiny[1]).toMatchObject({ key: "failed", count: 1 });
    expect(tiny[1].percent).toBeGreaterThan(0);
    expect(tiny.map((segment) => segment.share)).toEqual([">99%", "<1%", "0%"]);
  });
});

describe("successRateLabel", () => {
  it("is null when nothing has finished (no messages, or only pending ones)", () => {
    expect(successRateLabel({ sent: 0, failed: 0, pending: 0 })).toBeNull();
    expect(successRateLabel({ sent: 0, failed: 0, pending: 3 })).toBeNull();
  });

  it("is sent / (sent + failed) and says when pending messages are not counted", () => {
    expect(successRateLabel({ sent: 8, failed: 1, pending: 1 })).toBe(
      "89% success rate (pending messages not counted)",
    );
    expect(successRateLabel({ sent: 5, failed: 0, pending: 0 })).toBe("100% success rate");
  });

  it("never reads 100% while a message failed, or 0% while one succeeded", () => {
    expect(successRateLabel({ sent: 1000, failed: 1, pending: 0 })).toBe(">99% success rate");
    expect(successRateLabel({ sent: 1, failed: 1000, pending: 0 })).toBe("<1% success rate");
  });
});

describe("setupSteps", () => {
  it("starts with both steps open for a brand-new business", () => {
    const steps = setupSteps(summary());
    expect(steps.map((step) => [step.id, step.done])).toEqual([
      ["customer", false],
      ["campaign", false],
    ]);
    expect(showSetupChecklist(steps)).toBe(true);
  });

  it("marks the customer step done once there is a customer", () => {
    const steps = setupSteps(summary({ customers: { total: 1, emailOptedIn: 0, smsOptedIn: 0, unsubscribed: 1 } }));
    expect(steps[0].done).toBe(true);
    expect(steps[1].done).toBe(false);
    expect(showSetupChecklist(steps)).toBe(true);
  });

  it("does not count a draft as a sent campaign", () => {
    const steps = setupSteps(
      summary({ campaigns: { total: 2, draft: 2, queued: 0, sent: 0, failed: 0 } }),
    );
    expect(steps[1].done).toBe(false);
  });

  it("counts a queued, sent or failed campaign as the campaign step", () => {
    for (const campaigns of [
      { total: 1, draft: 0, queued: 1, sent: 0, failed: 0 },
      { total: 1, draft: 0, queued: 0, sent: 1, failed: 0 },
      { total: 1, draft: 0, queued: 0, sent: 0, failed: 1 },
    ]) {
      expect(setupSteps(summary({ campaigns }))[1].done).toBe(true);
    }
  });

  it("hides the checklist once both steps are done", () => {
    const steps = setupSteps(
      summary({
        customers: { total: 3, emailOptedIn: 3, smsOptedIn: 0, unsubscribed: 0 },
        campaigns: { total: 1, draft: 0, queued: 0, sent: 1, failed: 0 },
      }),
    );
    expect(showSetupChecklist(steps)).toBe(false);
  });
});

describe("campaignHref", () => {
  it("opens drafts on the Audience tab for both channels and everything else on the Results tab", () => {
    for (const channel of ["EMAIL", "SMS"] as const) {
      // Callers pass whole campaigns, so the channel is present but must not matter.
      const draft = { id: "c9", status: "DRAFT", channel } as const;
      expect(campaignHref("b1", draft)).toBe("/businesses/b1/campaigns/c9/preview");
      for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
        const other = { id: "c9", status, channel };
        expect(campaignHref("b1", other)).toBe(
          "/businesses/b1/campaigns/c9/analytics",
        );
      }
    }
  });
});

describe("formatDate", () => {
  it("formats an ISO timestamp as a medium date", () => {
    expect(formatDate("2026-10-12T15:30:00Z", "UTC")).toBe("Oct 12, 2026");
  });

  it("returns an empty string for an invalid date instead of throwing", () => {
    expect(formatDate("not a date")).toBe("");
  });
});
