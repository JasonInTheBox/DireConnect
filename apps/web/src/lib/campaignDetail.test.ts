import { describe, expect, it } from "vitest";
import {
  audienceIntro,
  DETAIL_TABS,
  defaultDetailSegment,
  detailHref,
  failureHeadline,
  failureReasons,
  headerActionsFor,
  logStatusMeta,
  resultsNotes,
  sendLimitNotes,
} from "./campaignDetail";

const now = new Date("2030-01-15T12:00:00.000Z");

describe("tabs and hrefs", () => {
  it("lists Audience, Results and Delivery log in order", () => {
    expect(DETAIL_TABS.map((tab) => tab.label)).toEqual(["Audience", "Results", "Delivery log"]);
    expect(DETAIL_TABS.map((tab) => tab.segment)).toEqual(["preview", "analytics", "logs"]);
  });

  it("builds campaign hrefs", () => {
    expect(detailHref("b1", "k-1")).toBe("/businesses/b1/campaigns/k-1");
    expect(detailHref("b1", "k-1", "analytics")).toBe("/businesses/b1/campaigns/k-1/analytics");
    expect(detailHref("b1", "k-1", "send")).toBe("/businesses/b1/campaigns/k-1/send");
  });

  it("opens drafts on Audience and everything else on Results", () => {
    expect(defaultDetailSegment("DRAFT")).toBe("preview");
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(defaultDetailSegment(status)).toBe("analytics");
    }
  });
});

describe("headerActionsFor", () => {
  it("offers edit, send and delete for an email draft", () => {
    expect(headerActionsFor({ status: "DRAFT", channel: "EMAIL" })).toEqual({
      edit: true,
      send: true,
      remove: true,
    });
  });

  it("offers only delete for an SMS draft", () => {
    expect(headerActionsFor({ status: "DRAFT", channel: "SMS" })).toEqual({
      edit: false,
      send: false,
      remove: true,
    });
  });

  it("offers nothing once a campaign is queued, sent or failed", () => {
    for (const status of ["QUEUED", "SENT", "FAILED"] as const) {
      expect(headerActionsFor({ status, channel: "EMAIL" })).toEqual({
        edit: false,
        send: false,
        remove: false,
      });
    }
  });
});

describe("audienceIntro", () => {
  it("explains a live draft preview", () => {
    expect(audienceIntro({ status: "DRAFT" }, { isSnapshot: false })).toMatch(/right now/);
  });

  it("explains a saved recipient list", () => {
    expect(audienceIntro({ status: "SENT" }, { isSnapshot: true })).toMatch(/fixed when the campaign was queued/);
  });

  it("explains an older campaign without a saved list", () => {
    expect(audienceIntro({ status: "SENT" }, { isSnapshot: false })).toMatch(/older campaign/);
  });
});

describe("resultsNotes", () => {
  it("always explains background delivery and daily limits", () => {
    const notes = resultsNotes({ status: "SENT", sendAt: null }, now, "UTC");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/background/);
    expect(notes[0]).toMatch(/Daily sending limits/);
  });

  it("says when a campaign is queued or scheduled", () => {
    expect(resultsNotes({ status: "QUEUED", sendAt: null }, now, "UTC")[0]).toMatch(/queued and waiting/);
    const scheduled = resultsNotes({ status: "QUEUED", sendAt: "2030-02-01T09:30:00.000Z" }, now, "UTC");
    expect(scheduled).toHaveLength(2);
    expect(scheduled[0]).toMatch(/scheduled for Feb 1, 2030/);
  });

  it("says when a campaign did not finish sending", () => {
    const notes = resultsNotes({ status: "FAILED", sendAt: null }, now, "UTC");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toBe("This campaign didn’t finish sending.");
    expect(notes[1]).toMatch(/background/);
  });
});

describe("sendLimitNotes", () => {
  it("states the mirrored limits", () => {
    const notes = sendLimitNotes();
    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatch(/one campaign email every 24 hours/);
    expect(notes[1]).toContain("25");
    expect(notes[2]).toContain("100");
  });
});

describe("logStatusMeta", () => {
  it("gives every log status its own label, tone and icon", () => {
    expect(logStatusMeta("SENT")).toEqual({ label: "Sent", tone: "success", icon: "check" });
    expect(logStatusMeta("FAILED")).toEqual({ label: "Failed", tone: "danger", icon: "alert" });
    expect(logStatusMeta("PENDING")).toEqual({ label: "Pending", tone: "warning", icon: "clock" });
  });
});

describe("failureReasons", () => {
  it("keeps the worker's wording, most common first", () => {
    expect(
      failureReasons({
        "Daily limit reached for this account": 1,
        "Mailbox does not exist": 3,
        "Another reason": 1,
      }),
    ).toEqual([
      { label: "Mailbox does not exist", count: 3 },
      { label: "Another reason", count: 1 },
      { label: "Daily limit reached for this account", count: 1 },
    ]);
  });

  it("returns nothing when there were no failures", () => {
    expect(failureReasons({})).toEqual([]);
  });
});

describe("failureHeadline", () => {
  it("names the most common failure reason", () => {
    expect(
      failureHeadline({ "Mailbox does not exist": 3, "Daily limit reached for this account": 1 }),
    ).toBe("Most messages failed because: Mailbox does not exist (3 of 4).");
  });

  it("is plain when there is a single reason", () => {
    expect(failureHeadline({ "Daily limit reached for this account": 2 })).toBe(
      "Messages failed because: Daily limit reached for this account (2 of 2).",
    );
  });

  it("returns null when nothing failed", () => {
    expect(failureHeadline({})).toBeNull();
  });
});
