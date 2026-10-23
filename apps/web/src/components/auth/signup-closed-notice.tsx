"use client";

import { useEffect, useRef } from "react";
import { SIGNUP_CLOSED_TEXT, SIGNUP_CLOSED_TITLE } from "@/lib/signupStatus";

/**
 * Tells visitors that DireConnect is not creating new accounts. Text only, so it never relies on
 * colour. `focusOnMount` moves focus here when the notice replaces a form the visitor was using.
 */
export function SignupClosedNotice({ focusOnMount = false }: { focusOnMount?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="note"
      className="rounded-container border border-line bg-sunken px-4 py-3 text-left text-sm"
    >
      <p className="font-medium text-ink">{SIGNUP_CLOSED_TITLE}</p>
      <p className="mt-1 text-muted">{SIGNUP_CLOSED_TEXT}</p>
    </div>
  );
}
