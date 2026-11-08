import { describe, expect, it } from "vitest";
import {
  SIGNUP_CLOSED_TEXT,
  SIGNUP_CLOSED_TITLE,
  initialSignupStatus,
  isSignupDisabledError,
  parseSignupSettings,
} from "./signupStatus";

describe("parseSignupSettings", () => {
  it("reads disable_signup from Supabase's public settings", () => {
    expect(parseSignupSettings({ disable_signup: true })).toBe("closed");
    expect(parseSignupSettings({ disable_signup: false })).toBe("open");
  });

  it("does not guess when the answer is missing or malformed", () => {
    expect(parseSignupSettings({})).toBe("unknown");
    expect(parseSignupSettings(null)).toBe("unknown");
    expect(parseSignupSettings("closed")).toBe("unknown");
    expect(parseSignupSettings({ disable_signup: "yes" })).toBe("unknown");
  });
});

describe("isSignupDisabledError", () => {
  it("recognises the signup_disabled code", () => {
    expect(isSignupDisabledError({ code: "signup_disabled", status: 422 })).toBe(true);
  });

  it("recognises the message older GoTrue versions send without a code", () => {
    expect(isSignupDisabledError({ message: "Signups not allowed for this instance" })).toBe(true);
  });

  it("ignores other errors and non-objects", () => {
    expect(isSignupDisabledError({ code: "weak_password" })).toBe(false);
    expect(isSignupDisabledError(null)).toBe(false);
    expect(isSignupDisabledError("signup_disabled")).toBe(false);
  });
});

describe("copy", () => {
  it("explains that the project is non-commercial", () => {
    expect(SIGNUP_CLOSED_TITLE).toBe("Accounts are by invitation");
    expect(SIGNUP_CLOSED_TEXT).toContain("non-commercial");
  });
});

describe("initialSignupStatus", () => {
  it("waits for the settings request only when Supabase is configured", () => {
    expect(initialSignupStatus("https://x.supabase.co", "key")).toBe("checking");
  });

  it("is open at once, without a request, when the URL or key is unset or empty", () => {
    expect(initialSignupStatus(undefined, "key")).toBe("open");
    expect(initialSignupStatus("https://x.supabase.co", undefined)).toBe("open");
    expect(initialSignupStatus("", "")).toBe("open");
  });
});
