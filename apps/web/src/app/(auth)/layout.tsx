import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="paper-auth relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <ThemeToggle className="absolute right-4 top-4" />
      <Link href="/" className="mb-8 rounded-control" aria-label="DireConnect home">
        <BrandMark />
      </Link>
      {children}
    </main>
  );
}
