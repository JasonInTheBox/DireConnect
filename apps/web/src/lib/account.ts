export type PasswordFormValues = { password: string; confirm: string };

export function validatePasswordForm(values: PasswordFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.password) {
    errors.password = "Enter a new password.";
  }
  if (!values.confirm) {
    errors.confirm = "Repeat the new password.";
  } else if (values.password && values.confirm !== values.password) {
    errors.confirm = "The passwords don’t match.";
  }
  return errors;
}

/** Supabase explains password problems in plain English; those belong beside the field. */
export function passwordErrorTarget(message: string): "password" | "form" {
  return /password/i.test(message) ? "password" : "form";
}

export function authErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
