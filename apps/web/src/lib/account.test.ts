import { describe, expect, it } from "vitest";
import { authErrorMessage, passwordErrorTarget, validatePasswordForm } from "./account";

describe("validatePasswordForm", () => {
  it("accepts a matching, non-empty pair", () => {
    expect(validatePasswordForm({ password: "correct horse", confirm: "correct horse" })).toEqual({});
  });

  it("asks for a password and for the repeat", () => {
    expect(validatePasswordForm({ password: "", confirm: "" })).toEqual({
      password: "Enter a new password.",
      confirm: "Repeat the new password.",
    });
  });

  it("refuses a mismatch", () => {
    expect(validatePasswordForm({ password: "one", confirm: "two" })).toEqual({
      confirm: "The passwords don’t match.",
    });
  });

  it("does not call an empty password a mismatch", () => {
    expect(validatePasswordForm({ password: "", confirm: "x" })).toEqual({
      password: "Enter a new password.",
    });
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
