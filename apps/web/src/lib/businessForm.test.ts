import { describe, expect, it } from "vitest";
import { businessFormValues, businessPayload } from "./businessForm";

describe("businessFormValues", () => {
  it("starts empty", () => {
    expect(businessFormValues()).toEqual({
      name: "",
      description: "",
      email: "",
      phone: "",
      website: "",
    });
  });

  it("prefills from a business, turning nulls into empty strings", () => {
    expect(
      businessFormValues({
        id: "b1",
        ownerId: "u1",
        name: "Corner Bakery",
        description: null,
        email: "hello@bakery.test",
      }),
    ).toEqual({
      name: "Corner Bakery",
      description: "",
      email: "hello@bakery.test",
      phone: "",
      website: "",
    });
  });
});

describe("businessPayload", () => {
  it("trims every field", () => {
    expect(
      businessPayload({
        name: "  Night Market ",
        description: " Late snacks ",
        email: " a@b.co ",
        phone: " 555 ",
        website: " example.com ",
      }),
    ).toEqual({
      name: "Night Market",
      description: "Late snacks",
      email: "a@b.co",
      phone: "555",
      website: "example.com",
    });
  });
});
