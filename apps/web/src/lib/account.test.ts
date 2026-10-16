import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  isWrongPassword,
  passwordErrorTarget,
  validatePasswordForm,
} from "./account";

describe("validatePasswordForm", () => {
  it("accepts a matching, non-empty pair", () => {
    expect(validatePasswordForm({ current: "old-password", password: "correct horse", confirm: "correct horse" })).toEqual({});
  });

  it("asks for a password and for the repeat", () => {
    expect(validatePasswordForm({ current: "old-password", password: "", confirm: "" })).toEqual({
      password: "Enter a new password.",
      confirm: "Repeat the new password.",
    });
  });

  it("refuses a mismatch", () => {
    expect(validatePasswordForm({ current: "old-password", password: "one", confirm: "two" })).toEqual({
      confirm: "The passwords don’t match.",
    });
  });

  it("asks for the current password", () => {
    expect(validatePasswordForm({ current: "", password: "new-one", confirm: "new-one" })).toEqual({
      current: "Enter your current password.",
    });
  });

  it("refuses a new password equal to the current one", () => {
    expect(
      validatePasswordForm({ current: "same-one", password: "same-one", confirm: "same-one" }),
    ).toEqual({ password: "Choose a password that is different from the current one." });
  });

  it("does not call an empty password a mismatch", () => {
    expect(validatePasswordForm({ current: "old-password", password: "", confirm: "x" })).toEqual({
      password: "Enter a new password.",
    });
  });
});

describe("isWrongPassword", () => {
  it("recognises a refused sign-in but not a network failure or a rate limit", () => {
    expect(isWrongPassword({ code: "invalid_credentials", status: 400 })).toBe(true);
    expect(isWrongPassword({ status: 400 })).toBe(true);
    expect(isWrongPassword({ code: "over_request_rate_limit", status: 429 })).toBe(false);
    expect(isWrongPassword({ name: "AuthRetryableFetchError", status: 0 })).toBe(false);
    expect(isWrongPassword(null)).toBe(false);
  });
});

describe("passwordErrorTarget", () => {
  it("puts password problems on the password field and everything else on the form", () => {
    expect(passwordErrorTarget("Password should be at least 6 characters.")).toBe("password");
    expect(passwordErrorTarget("New password should be different from the old password.")).toBe(
      "password",
    );
    expect(passwordErrorTarget("Auth session missing!")).toBe("form");
  });
});

describe("authErrorMessage", () => {
  it("uses an error's own message, or the fallback", () => {
    expect(authErrorMessage(new Error("Nope"), "Fallback")).toBe("Nope");
    expect(authErrorMessage(new Error(""), "Fallback")).toBe("Fallback");
    expect(authErrorMessage("weird", "Fallback")).toBe("Fallback");
    expect(authErrorMessage(null, "Fallback")).toBe("Fallback");
  });
});
