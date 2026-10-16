import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  isRecoverNetworkFailure,
  isRecoverNeutralFailure,
  isRecoverRateLimited,
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

  it("explains a request that never got a reply instead of showing the browser's text", () => {
    const unreachable = Object.assign(new Error("Failed to fetch"), {
      name: "AuthRetryableFetchError",
      status: 0,
    });
    expect(authErrorMessage(unreachable, "Fallback")).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
    const serverError = Object.assign(new Error("Database error"), { status: 500 });
    expect(authErrorMessage(serverError, "Fallback")).toBe("Database error");
  });
});

const cooldown = {
  status: 429,
  code: "over_email_send_rate_limit",
  message: "For security purposes, you can only request this after 52 seconds.",
};

describe("password recovery error classes", () => {
  it("treats only a request that never got a reply as a network failure", () => {
    expect(isRecoverNetworkFailure({ status: 0, name: "AuthRetryableFetchError" })).toBe(true);
    expect(isRecoverNetworkFailure({ status: 500, name: "AuthRetryableFetchError" })).toBe(false);
    expect(isRecoverNetworkFailure({ status: 502 })).toBe(false);
    expect(isRecoverNetworkFailure({ status: 429, code: "over_request_rate_limit" })).toBe(false);
    expect(isRecoverNetworkFailure({ status: 400 })).toBe(false);
    expect(isRecoverNetworkFailure(null)).toBe(false);
  });

  it("treats server failures and email limits as neutral, because only real accounts cause them", () => {
    expect(isRecoverNeutralFailure({ status: 500 })).toBe(true);
    expect(isRecoverNeutralFailure({ status: 502 })).toBe(true);
    expect(isRecoverNeutralFailure({ status: 503 })).toBe(true);
    // auth-js throws every HTTP 5xx as a retryable fetch error that still carries the status.
    expect(isRecoverNeutralFailure({ name: "AuthRetryableFetchError", status: 500 })).toBe(true);
    expect(isRecoverNeutralFailure({ status: 429, code: "over_email_send_rate_limit", message: "Email rate limit exceeded" })).toBe(true);
    expect(isRecoverNeutralFailure(cooldown)).toBe(true);
    expect(isRecoverNeutralFailure({ status: 429, message: "For security purposes, you can only request this after 5 seconds." })).toBe(true);
    expect(isRecoverNeutralFailure({ status: 0, name: "AuthRetryableFetchError" })).toBe(false);
    expect(isRecoverNeutralFailure({ status: 429, code: "over_request_rate_limit" })).toBe(false);
    expect(isRecoverNeutralFailure({ status: 400 })).toBe(false);
    expect(isRecoverNeutralFailure(null)).toBe(false);
  });

  it("calls a 429 a rate limit only when it says nothing about the account", () => {
    expect(isRecoverRateLimited({ status: 429, code: "over_request_rate_limit", message: "Too many requests" })).toBe(true);
    expect(isRecoverRateLimited({ status: 429, message: "Slow down" })).toBe(true);
    expect(isRecoverRateLimited({ status: 429, code: "over_email_send_rate_limit" })).toBe(false);
    expect(isRecoverRateLimited(cooldown)).toBe(false);
    expect(isRecoverRateLimited({ status: 500 })).toBe(false);
    expect(isRecoverRateLimited({ status: 0 })).toBe(false);
    expect(isRecoverRateLimited({ status: 400 })).toBe(false);
    expect(isRecoverRateLimited(null)).toBe(false);
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
