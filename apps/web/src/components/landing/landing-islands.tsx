"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SignupClosedNotice } from "@/components/auth/signup-closed-notice";
import { buttonClasses } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";
import { useSignupStatus } from "@/lib/useSignupStatus";

/** The landing page is pre-rendered; signed-in visitors are sent on to their businesses. */
export function RedirectIfSignedIn() {
  const router = useRouter();
  useApiWarmup();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/businesses");
      }
    });
  }, [router]);

  return null;
}

/** "Log in" always; "Sign up" only once Supabase confirms sign-ups are open. */
export function NavAuthLinks() {
  const status = useSignupStatus();

  return (
    <>
      <Link href="/login" className={buttonClasses({ variant: "ghost" })}>
        Log in
      </Link>
      {status === "open" ? (
        <Link href="/signup" className={buttonClasses({ variant: "secondary" })}>
          Sign up
        </Link>
      ) : null}
    </>
  );
}

export function LandingSignupNotice() {
  return useSignupStatus() === "closed" ? <SignupClosedNotice /> : null;
}
