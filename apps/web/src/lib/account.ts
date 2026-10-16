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

/**
 * True when Supabase refused the sign-in because the password is wrong. Network failures and rate
 * limits are not a wrong password and must not be reported as one.
 */
export function isWrongPassword(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, status } = error as { code?: unknown; status?: unknown };
  return code === "invalid_credentials" || status === 400;
}

/** Supabase explains password problems in plain English; those belong beside the field. */
export function passwordErrorTarget(message: string): "password" | "form" {
  return /password/i.test(message) ? "password" : "form";
}

export function authErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
