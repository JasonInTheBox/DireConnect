"use client";

import { useEffect, useState } from "react";
import { initialSignupStatus, parseSignupSettings } from "./signupStatus";

const TIMEOUT_MS = 5000;

/**
 * Asks Supabase Auth's public settings whether sign-ups are turned off. Any failure (network,
 * timeout, non-2xx, bad JSON, an answer without `disable_signup`) counts as "open", so the form
 * stays usable; a refused sign-up is handled separately by `isSignupDisabledError`. Without a
 * Supabase URL and key it returns "open" at once and makes no request. Pages should not show the
 * sign-up form or link while the status is "checking".
 */
export function useSignupStatus(): "checking" | "open" | "closed" {
  const [status, setStatus] = useState<"checking" | "open" | "closed">(() =>
    initialSignupStatus(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  );

  useEffect(() => {
    if (initialSignupStatus(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) === "open") {
      return;
    }

    const controller = new AbortController();
    let unmounted = false;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    async function check(): Promise<"open" | "closed"> {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
          signal: controller.signal,
        });
        if (!response.ok) {
          return "open";
        }
        return parseSignupSettings(await response.json()) === "closed" ? "closed" : "open";
      } catch {
        return "open";
      }
    }

    void check().then((next) => {
      if (!unmounted) {
        setStatus(next);
      }
    });

    return () => {
      unmounted = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return status;
}
