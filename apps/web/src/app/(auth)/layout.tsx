import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand";

// One soft light from above; tokens keep dark mode in step.
const WASH: CSSProperties = {
  backgroundImage: [
    "radial-gradient(70% 55% at 50% 0%, color-mix(in srgb, var(--sky) 55%, transparent), transparent 75%)",
    "radial-gradient(40% 40% at 50% 100%, var(--accent-soft), transparent 80%)",
  ].join(","),
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="theme-bg theme-auth flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12" style={WASH}>
      <Link href="/" className="mb-8 rounded-control" aria-label="DireConnect home">
        <BrandMark />
      </Link>
      {children}
      <p className="mt-10 text-sm text-muted">Free and non-commercial while it is being tested.</p>
    </main>
  );
}
