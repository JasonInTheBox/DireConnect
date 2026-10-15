import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-container border border-line bg-surface p-5", className)}
    >
      <h2 id={id} className="text-base font-semibold text-ink">
        {title}
      </h2>
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
