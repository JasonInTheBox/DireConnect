import { createClient } from "@supabase/supabase-js";

/**
 * supabase-js reads the emailed recovery link (`#access_token=...&type=recovery`) as soon as the
 * client is created, and its `PASSWORD_RECOVERY` event can fire before any page has subscribed.
 * Remember the link's access token before the client exists, so the reset page can tell afterwards
 * whether the session supabase-js saved is the one from the link.
 */
function readRecoveryAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery" ? params.get("access_token") : null;
}

let recoveryToken = readRecoveryAccessToken();

/** The access token of the recovery link this page was opened with, or null if it was not opened with one. */
export function recoveryAccessToken(): string | null {
  return recoveryToken;
}

/** Call once the recovery session has been used, so a later visit to the reset page is not mistaken for one. */
export function clearRecoveryLink(): void {
  recoveryToken = null;
}

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)
