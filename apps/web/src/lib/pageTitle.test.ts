import { describe, expect, it } from "vitest";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("appends the product name", () => {
    expect(pageTitle("Customers")).toBe("Customers · DireConnect");
  });

  it("trims and falls back to the product name for a blank title", () => {
    expect(pageTitle("  Dashboard  ")).toBe("Dashboard · DireConnect");
    expect(pageTitle("")).toBe("DireConnect");
    expect(pageTitle("   ")).toBe("DireConnect");
  });
});
