import { cn } from "@/lib/cn";
import { monogramFor } from "@/lib/format";

export function Monogram({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-control bg-accent-soft font-semibold text-accent",
        size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs",
      )}
    >
      {monogramFor(name)}
    </span>
  );
}
