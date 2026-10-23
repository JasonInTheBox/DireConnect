import type { User } from "@supabase/supabase-js";

export type SessionUser = {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
};

/** Mirrors the API's `emailConfirmed` check so the UI can warn before the API refuses. */
export function toSessionUser(
  user: Pick<User, "id" | "email" | "email_confirmed_at" | "confirmed_at">,
): SessionUser {
  return {
    id: user.id,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
  };
}
