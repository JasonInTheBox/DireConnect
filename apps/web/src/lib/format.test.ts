import { describe, expect, it } from "vitest";
import { monogramFor } from "./format";

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
