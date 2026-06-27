import { describe, expect, it } from "vitest";
import { createBusinessSchema } from "./business.js";

describe("createBusinessSchema", () => {
  it("accepts a valid business", () => {
    const result = createBusinessSchema.safeParse({
      name: "Jason's Test Business",
      description: "A test business for DireConnect",
      email: "owner@example.com",
      phone: "1234567890",
      website: "https://example.com",
    });

    expect(result.success).toBe(true);
  });

  it("requires a business name", () => {
    const result = createBusinessSchema.safeParse({
      description: "Missing name",
      email: "owner@example.com",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = createBusinessSchema.safeParse({
      name: "Bad Email Business",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });
});
