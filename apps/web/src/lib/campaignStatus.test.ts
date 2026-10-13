import { describe, expect, it } from "vitest";
import { campaignStatusMeta, channelLabel } from "./campaignStatus";

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
