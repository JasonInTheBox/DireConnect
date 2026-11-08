"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
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

/** The section links on phones, where the header has no room for them. */
export function MobileNav({ links }: { links: Array<[string, string]> }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen(!open)}
        className={buttonClasses({ variant: "ghost", className: "w-10 px-0" })}
      >
        <Icon name={open ? "x" : "menu"} className="h-5 w-5" />
      </button>
      {open ? (
        <nav id="mobile-nav" aria-label="Site" className="absolute inset-x-0 top-full border-b border-line bg-canvas px-4 py-3 shadow-card">
          <ul>
            {links.map(([label, href]) => (
              <li key={href}>
                <a href={href} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-base text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
