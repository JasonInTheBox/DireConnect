import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./icons";

export function Panel({
  id,
  title,
  icon,
  children,
  className,
  link,
}: {
  id: string;
  title: string;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  /** A corner arrow to the full page, e.g. { href, label: "View customers" }. */
  link?: { href: string; label: string };
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-container border border-line bg-surface p-5 shadow-card", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={id} className="flex items-center gap-2.5 text-base font-semibold text-ink">
          {icon ? (
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-control bg-accent-soft text-accent">
              <Icon name={icon} />
            </span>
          ) : null}
          {title}
        </h2>
        {link ? (
          <Link
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className="-mr-1.5 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Icon name="arrowRight" className="h-5 w-5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** One label/value line inside a `<dl>`. Values use tabular figures so they align in a column. */
export function PanelRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="min-w-0 break-words text-muted [overflow-wrap:anywhere]">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}
