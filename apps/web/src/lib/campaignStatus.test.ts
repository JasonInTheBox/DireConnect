import { describe, expect, it } from "vitest";
import { campaignStatusMeta, channelLabel, displayStatusMeta, displayStatusOf } from "./campaignStatus";

describe("campaignStatusMeta", () => {
  it("gives every status a label, a tone and an icon", () => {
    expect(campaignStatusMeta("DRAFT")).toEqual({ label: "Draft", tone: "neutral", icon: "edit" });
    expect(campaignStatusMeta("QUEUED")).toEqual({ label: "Queued", tone: "accent", icon: "send" });
    expect(campaignStatusMeta("SENT")).toEqual({ label: "Sent", tone: "success", icon: "check" });
    expect(campaignStatusMeta("FAILED")).toEqual({ label: "Failed", tone: "danger", icon: "alert" });
  });

  it("never reuses an icon, so status is not carried by colour alone", () => {
    const icons = (["DRAFT", "QUEUED", "SENT", "FAILED"] as const).map(
      (status) => campaignStatusMeta(status).icon,
    );
    expect(new Set(icons).size).toBe(4);
  });
});

describe("channelLabel", () => {
  it("names the channels", () => {
    expect(channelLabel("EMAIL")).toBe("Email");
    expect(channelLabel("SMS")).toBe("SMS");
  });
});

describe("displayStatusOf", () => {
  const now = new Date("2030-01-15T12:00:00.000Z");

  it("shows a queued campaign with a future send time as Scheduled", () => {
    expect(displayStatusOf({ status: "QUEUED", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe(
      "SCHEDULED",
    );
  });

  it("keeps Queued when there is no future send time", () => {
    expect(displayStatusOf({ status: "QUEUED", sendAt: null }, now)).toBe("QUEUED");
    expect(displayStatusOf({ status: "QUEUED" }, now)).toBe("QUEUED");
    expect(displayStatusOf({ status: "QUEUED", sendAt: "2030-01-14T09:00:00.000Z" }, now)).toBe(
      "QUEUED",
    );
    expect(displayStatusOf({ status: "QUEUED", sendAt: "nonsense" }, now)).toBe("QUEUED");
  });

  it("never turns another status into Scheduled", () => {
    expect(displayStatusOf({ status: "DRAFT", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe(
      "DRAFT",
    );
    expect(displayStatusOf({ status: "SENT", sendAt: "2030-02-01T09:00:00.000Z" }, now)).toBe("SENT");
  });
});

describe("displayStatusMeta", () => {
  it("gives Scheduled its own label and icon", () => {
    expect(displayStatusMeta("SCHEDULED")).toEqual({
      label: "Scheduled",
      tone: "accent",
      icon: "clock",
    });
  });

  it("never reuses an icon across the five display statuses", () => {
    const icons = (["DRAFT", "QUEUED", "SCHEDULED", "SENT", "FAILED"] as const).map(
      (key) => displayStatusMeta(key).icon,
    );
    expect(new Set(icons).size).toBe(5);
  });
});
