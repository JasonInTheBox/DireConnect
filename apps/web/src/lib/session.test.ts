import { describe, expect, it } from "vitest";
import { toSessionUser } from "./session";

describe("toSessionUser", () => {
  it("marks the email confirmed when email_confirmed_at is set", () => {
    expect(
      toSessionUser({
        id: "u1",
        email: "owner@example.com",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        confirmed_at: undefined,
      }),
    ).toEqual({ id: "u1", email: "owner@example.com", emailConfirmed: true });
  });

  it("falls back to confirmed_at, matching the API check", () => {
    expect(
      toSessionUser({ id: "u1", email: "a@b.co", email_confirmed_at: undefined, confirmed_at: "x" })
        .emailConfirmed,
    ).toBe(true);
  });

  it("treats a missing confirmation and email as unconfirmed", () => {
    expect(
      toSessionUser({ id: "u1", email: undefined, email_confirmed_at: undefined, confirmed_at: undefined }),
    ).toEqual({ id: "u1", email: null, emailConfirmed: false });
  });
});
