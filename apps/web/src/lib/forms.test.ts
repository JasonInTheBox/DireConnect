import { describe, expect, it } from "vitest";
import { splitFieldErrors } from "./forms";

describe("splitFieldErrors", () => {
  it("keeps errors for fields the form renders", () => {
    expect(splitFieldErrors({ email: "Invalid email" }, ["email", "name"])).toEqual({
      fields: { email: "Invalid email" },
      unmapped: [],
    });
  });

  it("collects errors for fields the form does not render instead of dropping them", () => {
    expect(
      splitFieldErrors({ email: "Invalid email", channel: "Channel is required" }, ["email"]),
    ).toEqual({
      fields: { email: "Invalid email" },
      unmapped: ["Channel is required"],
    });
  });

  it("handles no errors", () => {
    expect(splitFieldErrors({}, ["email"])).toEqual({ fields: {}, unmapped: [] });
  });
});
