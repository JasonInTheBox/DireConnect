"use client";

import { useEffect, useState } from "react";
import { parseSignupSettings } from "./signupStatus";

const TIMEOUT_MS = 5000;

/**
 * Asks Supabase Auth's public settings whether sign-ups are turned off. Any failure (network,
 * timeout, non-2xx, bad JSON, an answer without `disable_signup`) counts as "open", so the form
 * stays usable; a refused sign-up is handled separately by `isSignupDisabledError`.
 */
export function useSignupStatus(): "checking" | "open" | "closed" {
  const [status, setStatus] = useState<"checking" | "open" | "closed">("checking");

  useEffect(() => {
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
