"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { buttonClasses } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function Home() {
  const router = useRouter();

  useApiWarmup();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/businesses");
      }
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold tracking-tight">DireConnect</p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">
          Talk to your customers directly.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Keep your customer list in one place, send email campaigns to the people who asked to hear
          from you, and see what was delivered.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className={buttonClasses({ variant: "primary" })}>
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses({ variant: "secondary" })}>
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
