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

export function authErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
