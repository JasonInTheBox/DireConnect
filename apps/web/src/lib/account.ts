export type PasswordFormValues = { current: string; password: string; confirm: string };

export function validatePasswordForm(values: PasswordFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.current) {
    errors.current = "Enter your current password.";
  }
  if (!values.password) {
    errors.password = "Enter a new password.";
  } else if (values.current && values.password === values.current) {
    errors.password = "Choose a password that is different from the current one.";
  }
  if (!values.confirm) {
    errors.confirm = "Repeat the new password.";
  } else if (values.password && values.confirm !== values.password) {
    errors.confirm = "The passwords don’t match.";
  }
  return errors;
}

/** The new-password form on the reset page: no current password, because the emailed link proves access. */
export function validateNewPassword(password: string, confirm: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!password) {
    errors.password = "Enter a new password.";
  }
  if (!confirm) {
    errors.confirm = "Repeat the new password.";
  } else if (password && confirm !== password) {
    errors.confirm = "The passwords don’t match.";
  }
  return errors;
}

export function validateResetEmail(email: string): Record<string, string> {
  const value = email.trim();
  if (!value) {
    return { email: "Enter your email address." };
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? {} : { email: "Enter a valid email address." };
}

/**
 * True when Supabase refused the sign-in because the password is wrong. Other refusals (captcha,
 * unconfirmed email, rate limits) and network failures are not a wrong password and must not be
 * reported as one. A bare 400 with no error code is treated as wrong credentials.
 */
export function isWrongPassword(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, status } = error as { code?: unknown; status?: unknown };
  if (code === undefined || code === null) {
    return status === 400;
  }
  return code === "invalid_credentials";
}

/** Supabase explains password problems in plain English; those belong beside the field. */
export function passwordErrorTarget(message: string): "password" | "form" {
  return /password/i.test(message) ? "password" : "form";
}

/** Shown when a Supabase call never got a reply (auth-js reports that as status 0, with the browser's own text). */
export const UNREACHABLE_MESSAGE = "Could not reach the server. Check your connection and try again.";

function errorField(error: unknown, field: "status" | "code" | "message"): unknown {
  return typeof error === "object" && error !== null ? (error as Record<string, unknown>)[field] : undefined;
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (errorField(error, "status") === 0) {
    return UNREACHABLE_MESSAGE;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

/*
 * Password-reset requests must look the same for registered and unregistered addresses. GoTrue
 * answers an unknown address with a silent 200 before it tries to send anything, so every failure
 * that can only happen once an email would really be sent (an SMTP or server error, the project-wide
 * email limit, the per-address cooldown) would tell an attacker the address has an account. Only
 * failures that say nothing about the address may be shown.
 */

/** The request never got a reply (auth-js uses status 0). An HTTP 5xx is NOT this: it has a status. */
export function isRecoverNetworkFailure(error: unknown): boolean {
  return errorField(error, "status") === 0;
}

/** Failures only a real account can cause: shown exactly like success. */
export function isRecoverNeutralFailure(error: unknown): boolean {
  const status = errorField(error, "status");
  if (typeof status === "number" && status >= 500 && status <= 599) {
    return true;
  }
  if (errorField(error, "code") === "over_email_send_rate_limit") {
    return true;
  }
  return status === 429 && /only request this after/i.test(String(errorField(error, "message") ?? ""));
}

/** A rate limit that says nothing about the address (per-IP or global), safe to show as such. */
export function isRecoverRateLimited(error: unknown): boolean {
  return errorField(error, "status") === 429 && !isRecoverNeutralFailure(error);
}
