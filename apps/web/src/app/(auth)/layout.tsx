import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icons";

const POINTS = [
  "Keep every customer who opted in, in one list",
  "Write a campaign and see exactly who gets it",
  "Follow every delivery as it goes out",
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel: desktop only, so the form stays first on phones. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b6fbf] to-[#083d6b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden="true" className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#38bdf8]/40 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-pop/30 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/20">
            <Icon name="send" />
          </span>
          DireConnect
        </Link>
        <div className="relative max-w-md">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Bring your regulars back, one careful email at a time.
          </p>
          <ul className="mt-8 space-y-3 text-lg text-white/90">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/80">Free and non-commercial. Loyalty rewards are on the way.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="flex w-full flex-col items-center">
          <Link href="/" className="mb-8 lg:hidden">
            <BrandMark />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
