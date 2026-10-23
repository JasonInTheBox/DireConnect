import { describe, expect, it } from "vitest";
import { monogramFor, pluralize } from "./format";

describe("monogramFor", () => {
  it("uses the first letter or digit, upper-cased", () => {
    expect(monogramFor("corner bakery")).toBe("C");
    expect(monogramFor("  fern florist")).toBe("F");
    expect(monogramFor("7th Street Cafe")).toBe("7");
  });

  it("skips symbols and emoji", () => {
    expect(monogramFor("😀 Night Market")).toBe("N");
    expect(monogramFor("—Étoile")).toBe("É");
  });

  it("falls back to a question mark", () => {
    expect(monogramFor("")).toBe("?");
    expect(monogramFor("   ")).toBe("?");
    expect(monogramFor("😀")).toBe("?");
  });
});

describe("pluralize", () => {
  it("uses the singular only for exactly one", () => {
    expect(pluralize(1, "customer")).toBe("1 customer");
    expect(pluralize(0, "customer")).toBe("0 customers");
    expect(pluralize(2, "customer")).toBe("2 customers");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(2, "person", "people")).toBe("2 people");
  });
});
