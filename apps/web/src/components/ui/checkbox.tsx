import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function CheckboxField({
  label,
  hint,
  id,
  className,
  ...props
}: {
  label: string;
  hint?: string;
  id?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id">) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="flex min-h-10 cursor-pointer items-start gap-3 rounded-control py-2 text-sm font-medium text-ink"
      >
        <input
          id={fieldId}
          type="checkbox"
          aria-describedby={hint ? `${fieldId}-hint` : undefined}
          className={cn("mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-accent", className)}
          {...props}
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <p id={`${fieldId}-hint`} className="pl-8 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
