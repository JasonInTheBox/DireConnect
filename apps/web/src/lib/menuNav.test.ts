import { describe, expect, it } from "vitest";
import { nextMenuIndex, typeAheadIndex } from "./menuNav";

describe("nextMenuIndex", () => {
  it("moves down and wraps", () => {
    expect(nextMenuIndex(0, 3, "ArrowDown")).toBe(1);
    expect(nextMenuIndex(2, 3, "ArrowDown")).toBe(0);
    expect(nextMenuIndex(-1, 3, "ArrowDown")).toBe(0);
  });

  it("moves up and wraps", () => {
    expect(nextMenuIndex(1, 3, "ArrowUp")).toBe(0);
    expect(nextMenuIndex(0, 3, "ArrowUp")).toBe(2);
    expect(nextMenuIndex(-1, 3, "ArrowUp")).toBe(2);
  });

  it("jumps to the ends", () => {
    expect(nextMenuIndex(1, 4, "Home")).toBe(0);
    expect(nextMenuIndex(1, 4, "End")).toBe(3);
  });

  it("returns -1 for an empty menu", () => {
    expect(nextMenuIndex(0, 0, "ArrowDown")).toBe(-1);
  });
});

describe("typeAheadIndex", () => {
  const labels = ["Alpha Cafe", "Beta Shop", "Bakery Row", "Create business"];

  it("finds the next label starting with a single typed letter", () => {
    expect(typeAheadIndex(labels, "b", -1)).toBe(1);
    expect(typeAheadIndex(labels, "b", 1)).toBe(2);
    expect(typeAheadIndex(labels, "b", 2)).toBe(1);
  });

  it("refines with more letters from the current item", () => {
    expect(typeAheadIndex(labels, "ba", 1)).toBe(2);
  });

  it("ignores case and surrounding spaces", () => {
    expect(typeAheadIndex(labels, " CR ", 0)).toBe(3);
  });

  it("returns -1 when nothing matches or the query is empty", () => {
    expect(typeAheadIndex(labels, "z", 0)).toBe(-1);
    expect(typeAheadIndex(labels, "", 0)).toBe(-1);
  });
});
