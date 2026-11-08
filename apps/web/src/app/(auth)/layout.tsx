import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="paper-auth flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <Link href="/" className="mb-8 rounded-control" aria-label="DireConnect home">
        <BrandMark />
      </Link>
      {children}
    </main>
  );
}
