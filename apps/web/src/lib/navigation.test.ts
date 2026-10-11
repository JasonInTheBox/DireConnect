import { describe, expect, it } from "vitest";
import {
  getBusinessIdFromPath,
  isNavActive,
  pathForBusinessSwitch,
} from "./navigation";

describe("getBusinessIdFromPath", () => {
  it("reads the business id from business routes", () => {
    expect(getBusinessIdFromPath("/businesses/b1/customers")).toBe("b1");
    expect(getBusinessIdFromPath("/businesses/b1")).toBe("b1");
    expect(getBusinessIdFromPath("/businesses/b1/campaigns/c9/logs")).toBe("b1");
  });

  it("returns null outside a business", () => {
    expect(getBusinessIdFromPath("/businesses")).toBeNull();
    expect(getBusinessIdFromPath("/businesses/")).toBeNull();
    expect(getBusinessIdFromPath("/login")).toBeNull();
    expect(getBusinessIdFromPath("/")).toBeNull();
  });
});

describe("pathForBusinessSwitch", () => {
  it("keeps the current section", () => {
    expect(pathForBusinessSwitch("/businesses/a/customers", "b")).toBe("/businesses/b/customers");
    expect(pathForBusinessSwitch("/businesses/a/dashboard", "b")).toBe("/businesses/b/dashboard");
  });

  it("goes to the campaign list from anywhere inside campaigns", () => {
    expect(pathForBusinessSwitch("/businesses/a/campaigns", "b")).toBe("/businesses/b/campaigns");
    expect(pathForBusinessSwitch("/businesses/a/campaigns/c1/analytics", "b")).toBe(
      "/businesses/b/campaigns",
    );
    expect(pathForBusinessSwitch("/businesses/a/campaigns/new", "b")).toBe(
      "/businesses/b/campaigns",
    );
  });

  it("opens the dashboard when not inside a business section", () => {
    expect(pathForBusinessSwitch("/businesses", "b")).toBe("/businesses/b/dashboard");
    expect(pathForBusinessSwitch("/businesses/a", "b")).toBe("/businesses/b/dashboard");
    expect(pathForBusinessSwitch("/account", "b")).toBe("/businesses/b/dashboard");
  });
});

describe("isNavActive", () => {
  it("matches the exact path and nested paths", () => {
    expect(isNavActive("/businesses/a/campaigns", "/businesses/a/campaigns")).toBe(true);
    expect(isNavActive("/businesses/a/campaigns/c1/logs", "/businesses/a/campaigns")).toBe(true);
  });

  it("does not match a sibling that shares a prefix", () => {
    expect(isNavActive("/businesses/a/customers", "/businesses/a/campaigns")).toBe(false);
    expect(isNavActive("/businesses/abc/dashboard", "/businesses/a")).toBe(false);
  });

  it("supports exact-only matching", () => {
    expect(isNavActive("/businesses", "/businesses", true)).toBe(true);
    expect(isNavActive("/businesses/a/dashboard", "/businesses", true)).toBe(false);
  });
});
