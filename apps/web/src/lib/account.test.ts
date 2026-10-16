import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  isWrongPassword,
  passwordErrorTarget,
  validateNewPassword,
  validatePasswordForm,
  validateResetEmail,
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
  it("recognises a refused sign-in", () => {
    expect(isWrongPassword({ code: "invalid_credentials", status: 400 })).toBe(true);
  });

  it("does not call other refusals of the password grant a wrong password", () => {
    expect(isWrongPassword({ code: "captcha_failed", status: 400 })).toBe(false);
    expect(isWrongPassword({ code: "email_not_confirmed", status: 400 })).toBe(false);
    expect(isWrongPassword({ code: "validation_failed", status: 400 })).toBe(false);
    expect(isWrongPassword({ code: "over_request_rate_limit", status: 429 })).toBe(false);
  });

  it("treats a bare 400 without an error code as wrong credentials, and nothing else", () => {
    expect(isWrongPassword({ status: 400 })).toBe(true);
    expect(isWrongPassword({ status: 429 })).toBe(false);
    expect(isWrongPassword({ name: "AuthRetryableFetchError", status: 0 })).toBe(false);
    expect(isWrongPassword(null)).toBe(false);
    expect(isWrongPassword("nope")).toBe(false);
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

describe("validateResetEmail", () => {
  it("accepts an email-looking value and trims it", () => {
    expect(validateResetEmail(" ada@example.com ")).toEqual({});
  });

  it("asks for an email, and for a valid one", () => {
    expect(validateResetEmail("")).toEqual({ email: "Enter your email address." });
    expect(validateResetEmail("   ")).toEqual({ email: "Enter your email address." });
    expect(validateResetEmail("not-an-email")).toEqual({ email: "Enter a valid email address." });
  });
});

describe("validateNewPassword", () => {
  it("accepts a matching, non-empty pair", () => {
    expect(validateNewPassword("correct horse", "correct horse")).toEqual({});
  });

  it("asks for a password and for the repeat", () => {
    expect(validateNewPassword("", "")).toEqual({
      password: "Enter a new password.",
      confirm: "Repeat the new password.",
    });
  });

  it("refuses a mismatch", () => {
    expect(validateNewPassword("one", "two")).toEqual({ confirm: "The passwords don’t match." });
  });

  it("asks for the repeat when only the password is filled in", () => {
    expect(validateNewPassword("one", "")).toEqual({ confirm: "Repeat the new password." });
  });
});
