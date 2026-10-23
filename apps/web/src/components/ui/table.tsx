import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The wrapper deliberately has no `overflow` so row action menus (absolutely positioned) are not clipped.
// `fixed` lays columns out from the header widths so long cells truncate instead of widening the table.
export function Table({
  caption,
  fixed = false,
  children,
}: {
  caption: string;
  fixed?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-container border border-line bg-surface">
      <table
        className={cn(
          "w-full border-separate border-spacing-0 text-left text-[13px]",
          fixed && "table-fixed",
        )}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="text-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="group">{children}</tr>;
}

// 9px = the wrapper's rounded-container (10px) minus its 1px border, so cell backgrounds match the outer corners.
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "bg-sunken px-4 py-2.5 font-medium first:rounded-tl-[9px] last:rounded-tr-[9px]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "border-t border-line px-4 py-3 align-middle transition-colors group-hover:bg-sunken [tr:last-child>&:first-child]:rounded-bl-[9px] [tr:last-child>&:last-child]:rounded-br-[9px]",
        className,
      )}
    >
      {children}
    </td>
  );
}
