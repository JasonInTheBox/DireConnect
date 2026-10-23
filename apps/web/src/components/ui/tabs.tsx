"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavActive } from "@/lib/navigation";

/**
 * Tabs that are separate pages: a navigation landmark of links with `aria-current="page"`.
 * (The WAI-ARIA tablist pattern is for panels on one page; this is page navigation.)
 */
export function LinkTabs({
  label,
  items,
}: {
  label: string;
  items: Array<{ href: string; label: string }>;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center whitespace-nowrap px-3 text-sm font-medium transition-colors focus-visible:outline-offset-[-2px]",
                  active
                    ? "text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent"
                    : "text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
