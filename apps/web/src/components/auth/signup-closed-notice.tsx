import { SIGNUP_CLOSED_TEXT, SIGNUP_CLOSED_TITLE } from "@/lib/signupStatus";

/** Tells visitors that DireConnect is not creating new accounts. Text only, so it never relies on colour. */
export function SignupClosedNotice() {
  return (
    <div role="note" className="rounded-container border border-line bg-sunken px-4 py-3 text-left text-sm">
      <p className="font-medium text-ink">{SIGNUP_CLOSED_TITLE}</p>
      <p className="mt-1 text-muted">{SIGNUP_CLOSED_TEXT}</p>
    </div>
  );
}
