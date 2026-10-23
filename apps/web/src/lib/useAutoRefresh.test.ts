import { describe, expect, it } from "vitest";
import { AUTO_REFRESH_MS, shouldAutoRefresh } from "./useAutoRefresh";

describe("shouldAutoRefresh", () => {
  it("polls only a queued campaign on a visible page", () => {
    expect(shouldAutoRefresh({ status: "QUEUED", visible: true })).toBe(true);
    expect(shouldAutoRefresh({ status: "QUEUED", visible: false })).toBe(false);
  });

  it("never polls drafts or finished campaigns", () => {
    for (const status of ["DRAFT", "SENT", "FAILED"] as const) {
      expect(shouldAutoRefresh({ status, visible: true })).toBe(false);
    }
  });

  it("polls at a sensible interval", () => {
    expect(AUTO_REFRESH_MS).toBeGreaterThanOrEqual(10_000);
  });
});
