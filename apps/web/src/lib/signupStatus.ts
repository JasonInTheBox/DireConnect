export const SIGNUP_CLOSED_TITLE = "Sign-up is closed";
export const SIGNUP_CLOSED_TEXT =
  "DireConnect is a non-commercial project, so new accounts aren’t being created right now. If you already have an account, you can log in.";

/**
 * The first status of the sign-up hook. Without a Supabase URL and publishable key there is nothing
 * to ask, so the form is shown at once ("open") instead of waiting for a request that cannot run.
 */
export function initialSignupStatus(
  supabaseUrl: string | undefined,
  publishableKey: string | undefined,
): "checking" | "open" {
  return supabaseUrl && publishableKey ? "checking" : "open";
}

export type SignupSettings = "open" | "closed" | "unknown";

/** Reads `disable_signup` from the body of Supabase Auth's public `GET /auth/v1/settings`. */
export function parseSignupSettings(body: unknown): SignupSettings {
  if (typeof body !== "object" || body === null) {
    return "unknown";
  }
  const disabled = (body as { disable_signup?: unknown }).disable_signup;
  if (disabled === true) return "closed";
  if (disabled === false) return "open";
  return "unknown";
}

/**
 * True when Supabase refused a sign-up because sign-ups are turned off. Current GoTrue sends the
 * code `signup_disabled`; older versions send only the message "Signups not allowed ...".
 */
export function isSignupDisabledError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (code === "signup_disabled") {
    return true;
  }
  return typeof message === "string" && /signups? not allowed/i.test(message);
}
