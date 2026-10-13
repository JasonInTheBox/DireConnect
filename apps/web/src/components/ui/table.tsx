import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The wrapper deliberately has no `overflow` so row action menus (absolutely positioned) are not clipped.
export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="rounded-container border border-line bg-surface">
      <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-sunken text-muted">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="transition-colors hover:bg-sunken">{children}</tr>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 font-medium first:rounded-tl-[9px] last:rounded-tr-[9px]",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-t border-line px-4 py-3 align-middle", className)}>{children}</td>;
}
