import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type Option = { value: string; label: string };

export function Select({
  label,
  hideLabel = false,
  options,
  id,
  className,
  ...props
}: {
  label: string;
  /** Keep the label for screen readers but do not show it (toolbar filters). */
  hideLabel?: boolean;
  options: Option[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">) {
  const autoId = useId();
  const selectId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={selectId}
        className={hideLabel ? "sr-only" : "block text-[13px] font-medium text-ink"}
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "block h-10 w-full appearance-none rounded-control border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink lg:h-9",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevrons"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </div>
    </div>
  );
}
